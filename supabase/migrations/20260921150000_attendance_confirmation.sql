-- Conferma presenza da parte dell'ente → XP/ore/badge al volontario (2026-09-21).
--
-- Modello: iscrizione all'attività immediata (REGISTERED); a fine attività (COMPLETATA) l'ente
-- conferma chi era presente (volunteer_reviews.is_present = true). La conferma, e solo quella,
-- assegna XP, ore e badge (award_activity_completion_to_user, idempotente per attività) e avvisa
-- il volontario. Nessun cambio dello stato di activity_participants: niente CHECKED_IN, quindi
-- nessun impatto sui filtri REGISTERED/APPROVED di chat, promemoria e report.
--
-- Problemi chiusi (verificati su staging prima della migration):
--  * un volontario poteva aggiornare il proprio stato in activity_participants (policy UPDATE senza
--    WITH CHECK): portandolo ad APPROVED prendeva +200 XP ad ogni cambio (farming illimitato) e
--    poteva auto-impostarsi CHECKED_IN. Ora può solo iscriversi (REGISTERED) o annullarsi.
--  * volunteer_reviews: qualunque ente poteva scrivere su qualunque volontario/attività.
--    Ora: solo il proprietario dell'attività, su attività COMPLETATA, per un iscritto;
--    la presenza confermata non si può revocare.
--  * award_gamification_xp: in assenza della riga di stato il ramo INSERT lasciava
--    profiles.impact_points = NULL (FOUND si riferiva alla SELECT su profiles); ora corretto.
--
-- Aggiunge: notifica BADGE_UNLOCKED alla prima assegnazione di un badge, notifica "presenza
-- confermata (+XP, livello)" al volontario, notifica all'ente a completamento attività
-- ("conferma le presenze"). Rimuove il vecchio trigger che dava 200 XP su status APPROVED.
--
-- Rollback (NON sicuro, ripristina i problemi sopra):
--   create policy "Participants can update own status" on public.activity_participants for update using (auth.uid() = user_id);
--   drop policy "Volunteers can join" on public.activity_participants;
--   create policy "Volunteers can join" on public.activity_participants for insert with check (auth.uid() = user_id);
--   drop trigger trg_volunteer_review_guard on public.volunteer_reviews;
--   drop trigger trg_volunteer_attendance_confirmed on public.volunteer_reviews;
--   drop function public.guard_volunteer_review_attendance(); drop function public.on_volunteer_attendance_confirmed();
--   e ripristinare le versioni precedenti di award_gamification_xp / notify_participants_on_activity_change
--   dalle migration precedenti.

-- 1) RLS activity_participants: il volontario non può più assegnarsi stati privilegiati.
drop policy if exists "Volunteers can join" on public.activity_participants;
create policy "Volunteers can join" on public.activity_participants
  for insert to authenticated
  with check (auth.uid() = user_id and status::text = 'REGISTERED');

drop policy if exists "Participants can update own status" on public.activity_participants;
create policy "Participants can update own status" on public.activity_participants
  for update to authenticated
  using (auth.uid() = user_id and status::text in ('REGISTERED', 'CANCELLED'))
  with check (auth.uid() = user_id and status::text in ('REGISTERED', 'CANCELLED'));

-- 2) Vecchio premio "200 XP su APPROVED": le iscrizioni non passano più da APPROVED.
drop trigger if exists trg_participation_status_gamification on public.activity_participants;
drop function if exists public.handle_participation_status_gamification();

-- 3) volunteer_reviews: guardia di integrità (solo l'ente proprietario, attività completata, iscritto).
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

  return new;
end;
$$;

drop trigger if exists trg_volunteer_review_guard on public.volunteer_reviews;
create trigger trg_volunteer_review_guard
  before insert or update on public.volunteer_reviews
  for each row execute function public.guard_volunteer_review_attendance();

-- 4) Presenza confermata → XP/ore/badge (idempotente) + notifica al volontario.
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
    v_msg := 'L''ente ha confermato la tua presenza a "' || coalesce(v_act.title, 'Attività') || '": hai guadagnato '
             || (v_xp1 - v_xp0)::text || ' XP.';
    if v_lvl1 > v_lvl0 then
      v_msg := v_msg || ' Sei salito al livello ' || v_lvl1::text || '!';
    end if;
    v_msg := v_msg || ' Ora puoi lasciare una recensione.';

    insert into public.notifications (user_id, type, title, message, related_activity_id, read)
    values (new.volunteer_id, 'ACTIVITY_COMPLETED', 'Presenza confermata ✅', v_msg, new.activity_id, false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_volunteer_attendance_confirmed on public.volunteer_reviews;
create trigger trg_volunteer_attendance_confirmed
  after insert or update of is_present on public.volunteer_reviews
  for each row execute function public.on_volunteer_attendance_confirmed();

-- 5) award_gamification_xp: notifica BADGE_UNLOCKED e correzione del ramo "stato mancante".
create or replace function public.award_gamification_xp(p_user_id uuid, p_xp_amount integer, p_badge jsonb default null::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_state record;
  v_new_xp integer;
  v_new_level integer;
  v_badges jsonb;
  v_created_at timestamptz;
  v_anni jsonb := '{"id": "anni", "name": "Anniversario", "icon": "🎂", "description": "Sei con noi da un anno. Grazie per il tuo impegno costante!", "color": "bg-pink-50"}'::jsonb;
  v_added jsonb[] := '{}';
  v_b jsonb;
begin
  select * into v_state from gamification_state where user_id = p_user_id;
  select created_at into v_created_at from profiles where id = p_user_id;

  if v_state.user_id is null then
    v_new_xp := coalesce(p_xp_amount, 0);
    v_badges := case when p_badge is null then '[]'::jsonb else jsonb_build_array(p_badge) end;
    insert into gamification_state (user_id, xp, level, badges, completed_activities_count, total_hours)
    values (p_user_id, v_new_xp, calculate_level_from_xp(v_new_xp), v_badges, 0, 0);
    if p_badge is not null then v_added := array_append(v_added, p_badge); end if;
  else
    v_new_xp := coalesce(v_state.xp, 0) + p_xp_amount;
    v_new_level := calculate_level_from_xp(v_new_xp);

    v_badges := coalesce(v_state.badges, '[]'::jsonb);

    if p_badge is not null then
      if not (v_badges @> jsonb_build_array(jsonb_build_object('id', p_badge->>'id'))) then
        v_badges := v_badges || jsonb_build_array(p_badge);
        v_added := array_append(v_added, p_badge);
      end if;
    end if;

    if v_created_at < now() - interval '1 year' then
      if not (v_badges @> '[{"id": "anni"}]'::jsonb) then
        v_badges := v_badges || jsonb_build_array(v_anni);
        v_added := array_append(v_added, v_anni);
      end if;
    end if;

    update gamification_state
       set xp = v_new_xp, level = v_new_level, badges = v_badges, updated_at = now()
     where user_id = p_user_id;
  end if;

  update profiles set impact_points = v_new_xp where id = p_user_id;

  foreach v_b in array v_added loop
    insert into notifications (user_id, type, title, message, read, payload)
    values (
      p_user_id, 'BADGE_UNLOCKED',
      'Nuovo badge sbloccato! ' || coalesce(v_b->>'icon', ''),
      coalesce(v_b->>'name', 'Badge') || ': ' || coalesce(v_b->>'description', ''),
      false,
      jsonb_build_object('badgeId', v_b->>'id')
    );
  end loop;
end;
$$;

-- 6) Notifiche a fine attività: al volontario (senza promettere XP prima della conferma) e all'ente.
create or replace function public.notify_participants_on_activity_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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
      v_title := 'Attività terminata';
      v_msg := 'L''attività "' || v_name || '" è terminata. Grazie per il tuo contributo! Quando l''ente confermerà la tua presenza riceverai i punti XP.';

      -- Promemoria all'ente: la conferma delle presenze assegna XP e ore ai volontari.
      insert into public.notifications (user_id, type, title, message, related_activity_id, read)
      select new.npo_id, 'ACTIVITY_COMPLETED', 'Conferma le presenze',
             'L''attività "' || v_name || '" è terminata: conferma chi ha partecipato per assegnare XP e ore ai volontari.',
             new.id, false
       where exists (
         select 1 from public.activity_participants ap
          where ap.activity_id = new.id and ap.status in ('APPROVED', 'REGISTERED')
       );
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

revoke all on function public.guard_volunteer_review_attendance() from public, anon, authenticated;
revoke all on function public.on_volunteer_attendance_confirmed() from public, anon, authenticated;
