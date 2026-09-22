-- Auto-conferma presenza dopo 72h + tracciamento fonte (npo/auto) + reminder
-- volontario -> NPO (2026-09-22).
--
-- Contesto: la conferma presenza (migration 20260921150000_attendance_confirmation.sql)
-- richiede un'azione attiva della NPO, senza scadenza. Verificato (backlog
-- 2026-09-22): se la NPO non risponde, il volontario resta indefinitamente
-- senza XP/ore/badge. Questa migration:
--
--  1) Aggiunge volunteer_reviews.confirmed_by ('npo' default | 'auto') per
--     distinguere una conferma reale della NPO da una scattata in automatico.
--     Il client NPO (services/ActivityService.ts submitVolunteerReviews) non
--     lo manda mai nel payload, quindi il default 'npo' si applica sempre
--     alle conferme reali senza toccare il client. 'auto' può essere scritto
--     SOLO dalla funzione di cron sotto, tramite un flag di sessione
--     (set_config); la guardia esistente lo forza altrimenti a 'npo', anche
--     se un client lo mandasse esplicitamente nel payload.
--  2) auto_confirm_stale_attendance(): cron orario che, per le attività
--     COMPLETATA da più di 72h con partecipanti senza nessuna riga
--     volunteer_reviews (cioè la NPO non si è mai espressa, né presente né
--     assente), inserisce una riga (is_present=true, confirmed_by='auto').
--     Fa scattare il trigger esistente on_volunteer_attendance_confirmed
--     (stesso path di XP/ore/badge, un INSERT per riga) e viene aggiornato
--     anche per usare un testo di notifica diverso in caso di auto-conferma.
--  3) request_attendance_confirmation_reminder(): RPC che il volontario
--     chiama dalla CTA "Invia promemoria all'ente" (schermata attività,
--     stato "In attesa conferma"). Verifica che sia davvero un iscritto in
--     attesa su quell'attività, poi notifica la NPO con un cooldown di 24h
--     per attività (non per singolo volontario) per evitare spam se più
--     volontari la usano lo stesso giorno.

-- 1) Colonna fonte della conferma.
alter table public.volunteer_reviews
  add column if not exists confirmed_by text not null default 'npo'
    check (confirmed_by in ('npo', 'auto'));

-- 2) Guardia: forza 'npo' a meno che non sia il cron di auto-conferma ad
--    aver alzato il flag di sessione (vedi auto_confirm_stale_attendance).
create or replace function public.guard_volunteer_review_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_act record;
begin
  select id, npo_id, status::text as status into v_act from public.activities where id = new.activity_id;

  if v_act.id is null or v_act.npo_id is distinct from new.npo_id then
    raise exception 'NOT_ACTIVITY_OWNER';
  end if;

  if tg_op = 'UPDATE' then
    if new.activity_id is distinct from old.activity_id
       or new.volunteer_id is distinct from old.volunteer_id
       or new.npo_id is distinct from old.npo_id then
      raise exception 'IMMUTABLE_KEYS';
    end if;
    if old.is_present is true and new.is_present is not true then
      raise exception 'ATTENDANCE_LOCKED';
    end if;
  end if;

  if v_act.status <> 'COMPLETATA' then
    raise exception 'ACTIVITY_NOT_COMPLETED';
  end if;

  if not exists (
    select 1 from public.activity_participants
     where activity_id = new.activity_id and user_id = new.volunteer_id
  ) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if new.confirmed_by = 'auto' and coalesce(current_setting('app.attendance_auto_confirm', true), '') = 'on' then
    new.confirmed_by := 'auto';
  else
    new.confirmed_by := 'npo';
  end if;

  return new;
end;
$$;

-- 3) Notifica al volontario: testo diverso se la conferma è scattata da sola.
create or replace function public.on_volunteer_attendance_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_act public.activities%rowtype;
  v_xp0 integer; v_lvl0 integer; v_xp1 integer; v_lvl1 integer;
  v_msg text;
  v_title text;
begin
  if new.is_present is not true then return new; end if;
  if tg_op = 'UPDATE' and old.is_present is true then return new; end if;

  select * into v_act from public.activities where id = new.activity_id;

  select coalesce(xp, 0), coalesce(level, 1) into v_xp0, v_lvl0
    from public.gamification_state where user_id = new.volunteer_id;
  v_xp0 := coalesce(v_xp0, 0); v_lvl0 := coalesce(v_lvl0, 1);

  perform public.award_activity_completion_to_user(new.volunteer_id, v_act);

  select coalesce(xp, 0), coalesce(level, 1) into v_xp1, v_lvl1
    from public.gamification_state where user_id = new.volunteer_id;
  v_xp1 := coalesce(v_xp1, 0); v_lvl1 := coalesce(v_lvl1, 1);

  if v_xp1 > v_xp0 then
    if new.confirmed_by = 'auto' then
      v_title := 'Presenza confermata automaticamente ✅';
      v_msg := 'Sono passate 72 ore e l''ente non ha confermato la tua presenza a "'
                || coalesce(v_act.title, 'Attività') || '": te l''abbiamo confermata comunque, hai guadagnato '
                || (v_xp1 - v_xp0)::text || ' XP.';
    else
      v_title := 'Presenza confermata ✅';
      v_msg := 'L''ente ha confermato la tua presenza a "' || coalesce(v_act.title, 'Attività') || '": hai guadagnato '
               || (v_xp1 - v_xp0)::text || ' XP.';
    end if;
    if v_lvl1 > v_lvl0 then
      v_msg := v_msg || ' Sei salito al livello ' || v_lvl1::text || '!';
    end if;
    v_msg := v_msg || ' Ora puoi lasciare una recensione.';

    insert into public.notifications (user_id, type, title, message, related_activity_id, read)
    values (new.volunteer_id, 'ACTIVITY_COMPLETED', v_title, v_msg, new.activity_id, false);
  end if;

  return new;
end;
$$;

-- 4) Cron orario: auto-conferma chi non ha ancora nessuna riga volunteer_reviews
--    72h dopo la fine dell'attività (NPO non si è mai espressa, né presente né
--    assente). Un solo INSERT...SELECT: il trigger BEFORE forza confirmed_by,
--    il trigger AFTER esistente assegna XP/ore/badge/notifica per ogni riga.
create or replace function public.auto_confirm_stale_attendance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  perform set_config('app.attendance_auto_confirm', 'on', true); -- true = solo per questa transazione

  with candidates as (
    select a.id as activity_id, a.npo_id, ap.user_id as volunteer_id
      from public.activities a
      join public.activity_participants ap on ap.activity_id = a.id
     where a.status = 'COMPLETATA'
       and a.date_end < now() - interval '72 hours'
       and ap.status in ('APPROVED', 'REGISTERED')
       and not exists (
         select 1 from public.volunteer_reviews vr
          where vr.activity_id = a.id and vr.volunteer_id = ap.user_id
       )
  ),
  inserted as (
    insert into public.volunteer_reviews (activity_id, npo_id, volunteer_id, is_present, confirmed_by)
    select activity_id, npo_id, volunteer_id, true, 'auto' from candidates
    on conflict (activity_id, npo_id, volunteer_id) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return jsonb_build_object('volunteers_confirmed', v_count);
end;
$$;

revoke all on function public.auto_confirm_stale_attendance() from public, anon, authenticated;
grant execute on function public.auto_confirm_stale_attendance() to postgres, service_role;

select cron.schedule(
  'auto-confirm-stale-attendance-hourly',
  '0 * * * *',
  $$select public.auto_confirm_stale_attendance();$$
);

-- 5) RPC per il volontario: chiede un reminder alla NPO (cooldown 24h/attività).
create or replace function public.request_attendance_confirmation_reminder(p_activity_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_act record;
  v_caller uuid := auth.uid();
  v_is_participant boolean;
  v_already_confirmed boolean;
  v_last_reminder timestamptz;
begin
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select id, npo_id, title, status into v_act from public.activities where id = p_activity_id;
  if v_act.id is null then
    raise exception 'ACTIVITY_NOT_FOUND';
  end if;

  if v_act.status <> 'COMPLETATA' then
    return 'activity_not_completed';
  end if;

  select exists (
    select 1 from public.activity_participants
     where activity_id = p_activity_id and user_id = v_caller and status in ('APPROVED', 'REGISTERED')
  ) into v_is_participant;
  if not v_is_participant then
    return 'not_a_participant';
  end if;

  select exists (
    select 1 from public.volunteer_reviews
     where activity_id = p_activity_id and volunteer_id = v_caller and is_present is true
  ) into v_already_confirmed;
  if v_already_confirmed then
    return 'already_confirmed';
  end if;

  select max(created_at) into v_last_reminder
    from public.notifications
   where user_id = v_act.npo_id
     and type = 'ATTENDANCE_REMINDER'
     and related_activity_id = p_activity_id;

  if v_last_reminder is not null and v_last_reminder > now() - interval '24 hours' then
    return 'already_sent_recently';
  end if;

  insert into public.notifications (user_id, type, title, message, related_activity_id, read)
  values (
    v_act.npo_id, 'ATTENDANCE_REMINDER', 'Un volontario aspetta la conferma 🙋',
    'Un volontario ti ha chiesto di confermare la sua presenza per "' || coalesce(v_act.title, 'un''attività')
      || '". Se non confermi entro 72h dalla fine dell''attività, la presenza verrà confermata automaticamente.',
    p_activity_id, false
  );

  return 'sent';
end;
$$;

revoke all on function public.request_attendance_confirmation_reminder(uuid) from public, anon;
grant execute on function public.request_attendance_confirmation_reminder(uuid) to authenticated;
