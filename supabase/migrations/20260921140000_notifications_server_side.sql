-- Notifiche generate solo lato server.
--
-- Problema (verificato su staging il 2026-09-21): la policy "System/Trigger insert" su
-- public.notifications era WITH CHECK (true) per il ruolo authenticated, quindi qualunque
-- utente poteva inserire notifiche per qualunque altro utente (spam / spoofing di messaggi
-- "ufficiali"). Il client inseriva da sé le notifiche di candidature, aggiornamento /
-- annullo / completamento attività e inviti NPO→volontario.
--
-- Fix: le notifiche nascono da trigger SECURITY DEFINER o da RPC che validano ruolo e
-- destinatario e costruiscono titolo/testo lato server; poi si toglie ogni INSERT client.
-- Restano possibili solo: trigger/RPC (owner), edge function con service role.
--
-- Rollback (ripristina il comportamento precedente, NON sicuro):
--   create policy "System/Trigger insert" on public.notifications for insert to authenticated with check (true);
--   grant insert on public.notifications to authenticated;
--   e drop dei trigger/funzioni creati qui.

-- 1) Candidature all'ente: nuova candidatura → ente; approvata/rifiutata → volontario.
create or replace function public.notify_on_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vol text;
  v_npo text;
begin
  if tg_op = 'INSERT' then
    if new.status::text <> 'PENDING' then
      return new;
    end if;
    select coalesce(nullif(trim(p.full_name), ''), 'Un volontario') into v_vol
      from public.profiles p where p.id = new.volunteer_id;
    insert into public.notifications (user_id, type, title, message, related_application_id, related_npo_id, read)
    values (
      new.npo_id,
      'APPLICATION_RECEIVED',
      'Nuova Candidatura! 📋',
      coalesce(v_vol, 'Un volontario') || ' si è candidato come volontario',
      new.id,
      new.npo_id,
      false
    );
  elsif new.status is distinct from old.status and new.status::text in ('APPROVED', 'REJECTED') then
    select coalesce(nullif(trim(p.npo_name), ''), nullif(trim(p.full_name), ''), 'L''ente') into v_npo
      from public.profiles p where p.id = new.npo_id;
    insert into public.notifications (user_id, type, title, message, related_application_id, related_npo_id, read)
    values (
      new.volunteer_id,
      case when new.status::text = 'APPROVED' then 'APPLICATION_APPROVED' else 'APPLICATION_REJECTED' end,
      case when new.status::text = 'APPROVED' then 'Candidatura Approvata! 🎉' else 'Candidatura Rifiutata' end,
      coalesce(v_npo, 'L''ente') ||
        case when new.status::text = 'APPROVED' then ' ha approvato la tua candidatura' else ' ha rifiutato la tua candidatura' end,
      new.id,
      new.npo_id,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_application_change on public.applications;
create trigger trg_notify_on_application_change
  after insert or update of status on public.applications
  for each row execute function public.notify_on_application_change();

-- 2) Attività: annullo / completamento / modifica sostanziale → iscritti (APPROVED/REGISTERED).
--    "Modifica sostanziale" = titolo, descrizione, data/ora, luogo (non immagine, categoria,
--    urgenza, posti, embedding). Una sola notifica per transizione di stato.
create or replace function public.notify_participants_on_activity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_title text;
  v_msg text;
  v_name text := coalesce(new.title, 'Attività');
begin
  if new.status is distinct from old.status then
    if new.status::text = 'CANCELLATA' and old.status::text in ('APERTA', 'IN_CORSO') then
      v_type := 'ACTIVITY_UPDATE';
      v_title := 'Attività annullata';
      v_msg := 'L''attività "' || v_name || '" a cui eri iscritto è stata annullata dall''ente.';
    elsif new.status::text = 'COMPLETATA' and old.status::text in ('APERTA', 'IN_CORSO') then
      v_type := 'ACTIVITY_COMPLETED';
      v_title := 'Missione Compiuta! 🎉';
      v_msg := 'L''attività "' || v_name || '" è terminata. Grazie per il tuo contributo! Controlla il tuo profilo per i punti XP.';
    else
      return new;
    end if;
  elsif new.status::text in ('APERTA', 'IN_CORSO') and (
        new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.date_start is distinct from old.date_start
     or new.date_end is distinct from old.date_end
     or new.location_address is distinct from old.location_address
  ) then
    v_type := 'ACTIVITY_UPDATE';
    v_title := 'Attività Aggiornata';
    v_msg := 'L''attività "' || v_name || '" a cui sei iscritto ha subito delle modifiche. Controlla i dettagli.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, type, title, message, related_activity_id, read)
  select ap.user_id, v_type, v_title, v_msg, new.id, false
    from public.activity_participants ap
   where ap.activity_id = new.id
     and ap.status in ('APPROVED', 'REGISTERED');

  return new;
end;
$$;

drop trigger if exists trg_notify_participants_on_activity_change on public.activities;
create trigger trg_notify_participants_on_activity_change
  after update of status, title, description, date_start, date_end, location_address on public.activities
  for each row execute function public.notify_participants_on_activity_change();

-- 3) Inviti NPO → volontario. Titolo e testo sono costruiti qui (il client non può
--    scrivere testo arbitrario a nome dell'ente). Ritorna true se inviato, false se
--    saltato (già invitato nelle ultime 24h, oppure blocco tra i due utenti).
create or replace function public.send_npo_invite(
  p_volunteer_id uuid,
  p_kind text,
  p_activity_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_npo text;
  v_activity_title text;
  v_target_activity uuid := null;
  v_title text;
  v_msg text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role::text = 'NPO') then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_volunteer_id and p.role::text = 'VOLUNTEER') then
    raise exception 'INVALID_RECIPIENT';
  end if;
  if p_kind not in ('OPEN_ACTIVITIES', 'APPLY', 'ACTIVITY') then
    raise exception 'INVALID_KIND';
  end if;

  select coalesce(nullif(trim(p.npo_name), ''), nullif(trim(p.full_name), ''), 'Una NPO') into v_npo
    from public.profiles p where p.id = v_uid;

  if p_kind = 'ACTIVITY' then
    select a.title into v_activity_title
      from public.activities a
     where a.id = p_activity_id and a.npo_id = v_uid and a.status::text in ('APERTA', 'IN_CORSO');
    if not found then
      raise exception 'INVALID_ACTIVITY';
    end if;
    v_target_activity := p_activity_id;
    v_title := 'Invito ad attività 🤝';
    v_msg := v_npo || ' ti invita a partecipare a "' || coalesce(v_activity_title, 'un''attività') || '"!';
  elsif p_kind = 'APPLY' then
    v_title := 'Invito a candidarti 🤝';
    v_msg := v_npo || ' ti invita a candidarti come volontario!';
  else
    v_title := 'Invito Attività 🤝';
    v_msg := v_npo || ' ti invita a partecipare alle proprie attività aperte!';
  end if;

  if exists (
    select 1 from public.blocked_users b
     where (b.blocker_id = p_volunteer_id and b.blocked_id = v_uid)
        or (b.blocker_id = v_uid and b.blocked_id = p_volunteer_id)
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.notifications n
     where n.user_id = p_volunteer_id
       and n.type = 'ACTIVITY_UPDATE'
       and n.related_npo_id = v_uid
       and n.related_activity_id is not distinct from v_target_activity
       and n.payload ->> 'invite' = p_kind
       and n.created_at > now() - interval '24 hours'
  ) then
    return false;
  end if;

  insert into public.notifications (user_id, type, title, message, related_activity_id, related_npo_id, read, payload)
  values (p_volunteer_id, 'ACTIVITY_UPDATE', v_title, v_msg, v_target_activity, v_uid, false,
          jsonb_build_object('invite', p_kind));
  return true;
end;
$$;

revoke all on function public.send_npo_invite(uuid, text, uuid) from public, anon;
grant execute on function public.send_npo_invite(uuid, text, uuid) to authenticated;

-- 4) Notifica manuale dell'admin (esito verifica ente, esito segnalazione).
create or replace function public.admin_send_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_type not in ('INFO', 'SUCCESS', 'URGENT') then
    raise exception 'INVALID_TYPE';
  end if;
  if coalesce(length(trim(p_title)), 0) = 0 or length(p_title) > 200 or coalesce(length(p_message), 0) > 1000 then
    raise exception 'INVALID_CONTENT';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'INVALID_RECIPIENT';
  end if;
  insert into public.notifications (user_id, type, title, message, read)
  values (p_user_id, p_type, p_title, coalesce(p_message, ''), false);
end;
$$;

revoke all on function public.admin_send_notification(uuid, text, text, text) from public, anon;
grant execute on function public.admin_send_notification(uuid, text, text, text) to authenticated;

-- 5) Le funzioni trigger non sono invocabili via RPC.
revoke all on function public.notify_on_application_change() from public, anon, authenticated;
revoke all on function public.notify_participants_on_activity_change() from public, anon, authenticated;

-- 6) Chiusura: nessun INSERT diretto dal client su notifications.
drop policy if exists "System/Trigger insert" on public.notifications;
revoke insert on public.notifications from anon, authenticated;
