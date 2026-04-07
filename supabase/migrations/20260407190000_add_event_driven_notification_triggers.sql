create or replace function public.notify_followed_npo_activity_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
  if new.npo_id is null or new.status = 'CANCELLATA' then
    return new;
  end if;

  v_message := coalesce(new.title, 'Una nuova attività è disponibile');

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    related_activity_id,
    read
  )
  select
    follower.follower_id,
    'FOLLOWED_NPO_ACTIVITY',
    'Nuova attività da una NPO che segui',
    v_message,
    new.id,
    false
  from public.npo_followers follower
  where follower.npo_id = new.npo_id;

  return new;
end;
$$;

create or replace function public.notify_followed_npo_post_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_role text;
  v_author_name text;
begin
  if new.author_id is null or new.status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, 'published') = 'published' then
    return new;
  end if;

  select role, coalesce(npo_name, full_name, 'Una NPO che segui')
    into v_author_role, v_author_name
  from public.profiles
  where id = new.author_id;

  if v_author_role <> 'NPO' then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    read
  )
  select
    follower.follower_id,
    'FOLLOWED_NPO_POST',
    v_author_name || ' ha pubblicato un aggiornamento',
    coalesce(left(new.caption, 120), 'Apri la community per vederlo.'),
    false
  from public.npo_followers follower
  where follower.npo_id = new.author_id;

  return new;
end;
$$;

create or replace function public.notify_followed_npo_story_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_role text;
  v_author_name text;
begin
  if new.author_id is null then
    return new;
  end if;

  select role, coalesce(npo_name, full_name, 'Una NPO che segui')
    into v_author_role, v_author_name
  from public.profiles
  where id = new.author_id;

  if v_author_role <> 'NPO' then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    read
  )
  select
    follower.follower_id,
    'FOLLOWED_NPO_STORY',
    v_author_name || ' ha pubblicato una nuova storia',
    coalesce(left(new.caption, 100), 'Apri la community per vederla.'),
    false
  from public.npo_followers follower
  where follower.npo_id = new.author_id;

  return new;
end;
$$;

create or replace function public.sync_activity_reminder_job(
  p_activity_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity record;
  v_participant record;
  v_scheduled_for timestamptz;
  v_dedupe_key text;
begin
  v_dedupe_key := 'activity_reminder_24h:' || p_activity_id::text || ':' || p_user_id::text;

  select id, title, date_start, status
    into v_activity
  from public.activities
  where id = p_activity_id;

  select activity_id, user_id, status
    into v_participant
  from public.activity_participants
  where activity_id = p_activity_id
    and user_id = p_user_id;

  if v_activity is null
     or v_participant is null
     or v_participant.status not in ('APPROVED', 'REGISTERED')
     or v_activity.status not in ('APERTA', 'IN_CORSO')
  then
    update public.notification_jobs
       set status = 'cancelled',
           last_error = 'conditions_not_met'
     where dedupe_key = v_dedupe_key
       and status in ('pending', 'processing');
    return;
  end if;

  v_scheduled_for := v_activity.date_start - interval '24 hours';

  if v_scheduled_for <= now() then
    update public.notification_jobs
       set status = 'cancelled',
           last_error = 'scheduled_time_passed'
     where dedupe_key = v_dedupe_key
       and status in ('pending', 'processing');
    return;
  end if;

  insert into public.notification_jobs (
    user_id,
    type,
    title,
    message,
    related_activity_id,
    payload,
    dedupe_key,
    scheduled_for,
    status,
    attempt_count,
    sent_at,
    last_error
  ) values (
    p_user_id,
    'ACTIVITY_REMINDER',
    'Domani hai un’attività',
    coalesce(v_activity.title, 'Attività in arrivo'),
    p_activity_id,
    jsonb_build_object('activityId', p_activity_id),
    v_dedupe_key,
    v_scheduled_for,
    'pending',
    0,
    null,
    null
  )
  on conflict (dedupe_key) do update
    set title = excluded.title,
        message = excluded.message,
        related_activity_id = excluded.related_activity_id,
        payload = excluded.payload,
        scheduled_for = excluded.scheduled_for,
        status = 'pending',
        sent_at = null,
        last_error = null;
end;
$$;

create or replace function public.sync_activity_reminder_jobs_for_activity(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant record;
begin
  for v_participant in
    select user_id
    from public.activity_participants
    where activity_id = p_activity_id
      and status in ('APPROVED', 'REGISTERED')
  loop
    perform public.sync_activity_reminder_job(p_activity_id, v_participant.user_id);
  end loop;
end;
$$;

create or replace function public.trigger_sync_activity_reminder_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.notification_jobs
       set status = 'cancelled',
           last_error = 'participant_removed'
     where dedupe_key = 'activity_reminder_24h:' || old.activity_id::text || ':' || old.user_id::text
       and status in ('pending', 'processing');
    return old;
  end if;

  perform public.sync_activity_reminder_job(new.activity_id, new.user_id);
  return new;
end;
$$;

create or replace function public.trigger_sync_activity_reminder_jobs_for_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_activity_reminder_jobs_for_activity(new.id);
  return new;
end;
$$;

create or replace function public.sync_npo_low_coverage_job(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity record;
  v_enrolled_count integer;
  v_scheduled_for timestamptz;
  v_dedupe_key text;
begin
  v_dedupe_key := 'npo_low_coverage:' || p_activity_id::text;

  select id, npo_id, title, status, date_start, slots_total
    into v_activity
  from public.activities
  where id = p_activity_id;

  if v_activity is null
     or v_activity.npo_id is null
     or v_activity.status not in ('APERTA', 'IN_CORSO')
     or coalesce(v_activity.slots_total, 0) <= 0
     or v_activity.date_start <= now()
  then
    update public.notification_jobs
       set status = 'cancelled',
           last_error = 'conditions_not_met'
     where dedupe_key = v_dedupe_key
       and status in ('pending', 'processing');
    return;
  end if;

  select count(*)
    into v_enrolled_count
  from public.activity_participants
  where activity_id = p_activity_id
    and status in ('APPROVED', 'REGISTERED');

  if (coalesce(v_enrolled_count, 0)::numeric / v_activity.slots_total::numeric) >= 0.5 then
    update public.notification_jobs
       set status = 'cancelled',
           last_error = 'coverage_recovered'
     where dedupe_key = v_dedupe_key
       and status in ('pending', 'processing');
    return;
  end if;

  v_scheduled_for := greatest(now(), v_activity.date_start - interval '3 days');

  insert into public.notification_jobs (
    user_id,
    type,
    title,
    message,
    related_activity_id,
    payload,
    dedupe_key,
    scheduled_for,
    status,
    attempt_count,
    sent_at,
    last_error
  ) values (
    v_activity.npo_id,
    'NPO_LOW_COVERAGE',
    'Attività da rinforzare',
    coalesce(v_activity.title, 'Una tua attività') || ' ha ancora pochi volontari iscritti',
    p_activity_id,
    jsonb_build_object('activityId', p_activity_id, 'npoId', v_activity.npo_id),
    v_dedupe_key,
    v_scheduled_for,
    'pending',
    0,
    null,
    null
  )
  on conflict (dedupe_key) do update
    set title = excluded.title,
        message = excluded.message,
        user_id = excluded.user_id,
        related_activity_id = excluded.related_activity_id,
        payload = excluded.payload,
        scheduled_for = excluded.scheduled_for,
        status = 'pending',
        sent_at = null,
        last_error = null;
end;
$$;

create or replace function public.trigger_sync_npo_low_coverage_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_npo_low_coverage_job(coalesce(new.activity_id, old.activity_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_notify_followed_npo_activity_on_insert on public.activities;
create trigger tr_notify_followed_npo_activity_on_insert
after insert on public.activities
for each row
execute function public.notify_followed_npo_activity_on_insert();

drop trigger if exists tr_notify_followed_npo_post_on_publish on public.community_posts;
create trigger tr_notify_followed_npo_post_on_publish
after insert or update of status on public.community_posts
for each row
execute function public.notify_followed_npo_post_on_publish();

drop trigger if exists tr_notify_followed_npo_story_on_insert on public.stories;
create trigger tr_notify_followed_npo_story_on_insert
after insert on public.stories
for each row
execute function public.notify_followed_npo_story_on_insert();

drop trigger if exists tr_sync_activity_reminder_job_on_participation on public.activity_participants;
create trigger tr_sync_activity_reminder_job_on_participation
after insert or update of status or delete on public.activity_participants
for each row
execute function public.trigger_sync_activity_reminder_job();

drop trigger if exists tr_sync_activity_reminder_jobs_on_activity_change on public.activities;
create trigger tr_sync_activity_reminder_jobs_on_activity_change
after update of date_start, status, title on public.activities
for each row
execute function public.trigger_sync_activity_reminder_jobs_for_activity();

drop trigger if exists tr_sync_npo_low_coverage_job_on_activity_change on public.activities;
create trigger tr_sync_npo_low_coverage_job_on_activity_change
after insert or update of status, date_start, slots_total, title on public.activities
for each row
execute function public.trigger_sync_npo_low_coverage_job();

drop trigger if exists tr_sync_npo_low_coverage_job_on_participation on public.activity_participants;
create trigger tr_sync_npo_low_coverage_job_on_participation
after insert or update of status or delete on public.activity_participants
for each row
execute function public.trigger_sync_npo_low_coverage_job();

insert into public.notification_jobs (
  user_id,
  type,
  title,
  message,
  related_activity_id,
  payload,
  dedupe_key,
  scheduled_for,
  status,
  attempt_count,
  sent_at,
  last_error
)
select
  ap.user_id,
  'ACTIVITY_REMINDER',
  'Domani hai un’attività',
  a.title,
  a.id,
  jsonb_build_object('activityId', a.id),
  'activity_reminder_24h:' || a.id::text || ':' || ap.user_id::text,
  a.date_start - interval '24 hours',
  'pending',
  0,
  null,
  null
from public.activities a
join public.activity_participants ap
  on ap.activity_id = a.id
where a.status in ('APERTA', 'IN_CORSO')
  and ap.status in ('APPROVED', 'REGISTERED')
  and a.date_start - interval '24 hours' > now()
on conflict (dedupe_key) do update
  set title = excluded.title,
      message = excluded.message,
      payload = excluded.payload,
      scheduled_for = excluded.scheduled_for,
      status = 'pending',
      sent_at = null,
      last_error = null;

insert into public.notification_jobs (
  user_id,
  type,
  title,
  message,
  related_activity_id,
  payload,
  dedupe_key,
  scheduled_for,
  status,
  attempt_count,
  sent_at,
  last_error
)
select
  a.npo_id,
  'NPO_LOW_COVERAGE',
  'Attività da rinforzare',
  a.title || ' ha ancora pochi volontari iscritti',
  a.id,
  jsonb_build_object('activityId', a.id, 'npoId', a.npo_id),
  'npo_low_coverage:' || a.id::text,
  greatest(now(), a.date_start - interval '3 days'),
  'pending',
  0,
  null,
  null
from public.activities a
left join lateral (
  select count(*)::integer as enrolled_count
  from public.activity_participants ap
  where ap.activity_id = a.id
    and ap.status in ('APPROVED', 'REGISTERED')
) coverage on true
where a.status in ('APERTA', 'IN_CORSO')
  and a.npo_id is not null
  and coalesce(a.slots_total, 0) > 0
  and a.date_start > now()
  and (coalesce(coverage.enrolled_count, 0)::numeric / a.slots_total::numeric) < 0.5
on conflict (dedupe_key) do update
  set title = excluded.title,
      message = excluded.message,
      payload = excluded.payload,
      scheduled_for = excluded.scheduled_for,
      status = 'pending',
      sent_at = null,
      last_error = null;

revoke all on function public.notify_followed_npo_activity_on_insert() from public, anon, authenticated;
revoke all on function public.notify_followed_npo_post_on_publish() from public, anon, authenticated;
revoke all on function public.notify_followed_npo_story_on_insert() from public, anon, authenticated;
revoke all on function public.sync_activity_reminder_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_activity_reminder_jobs_for_activity(uuid) from public, anon, authenticated;
revoke all on function public.trigger_sync_activity_reminder_job() from public, anon, authenticated;
revoke all on function public.trigger_sync_activity_reminder_jobs_for_activity() from public, anon, authenticated;
revoke all on function public.sync_npo_low_coverage_job(uuid) from public, anon, authenticated;
revoke all on function public.trigger_sync_npo_low_coverage_job() from public, anon, authenticated;

grant execute on function public.notify_followed_npo_activity_on_insert() to service_role;
grant execute on function public.notify_followed_npo_post_on_publish() to service_role;
grant execute on function public.notify_followed_npo_story_on_insert() to service_role;
grant execute on function public.sync_activity_reminder_job(uuid, uuid) to service_role;
grant execute on function public.sync_activity_reminder_jobs_for_activity(uuid) to service_role;
grant execute on function public.trigger_sync_activity_reminder_job() to service_role;
grant execute on function public.trigger_sync_activity_reminder_jobs_for_activity() to service_role;
grant execute on function public.sync_npo_low_coverage_job(uuid) to service_role;
grant execute on function public.trigger_sync_npo_low_coverage_job() to service_role;
