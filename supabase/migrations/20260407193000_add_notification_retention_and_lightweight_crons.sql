create or replace function public.cleanup_notification_retention(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_jobs_sent integer := 0;
  v_deleted_jobs_failed integer := 0;
  v_deleted_notifications integer := 0;
  v_deleted_stories integer := 0;
begin
  with deleted as (
    delete from public.notification_jobs
    where (
      status in ('sent', 'cancelled')
      and coalesce(sent_at, updated_at, created_at) < p_now - interval '7 days'
    ) or (
      status = 'failed'
      and coalesce(updated_at, created_at) < p_now - interval '30 days'
    )
    returning status
  )
  select
    count(*) filter (where status in ('sent', 'cancelled')),
    count(*) filter (where status = 'failed')
  into v_deleted_jobs_sent, v_deleted_jobs_failed
  from deleted;

  with deleted as (
    delete from public.notifications
    where created_at < p_now - interval '20 days'
    returning id
  )
  select count(*) into v_deleted_notifications from deleted;

  with deleted as (
    delete from public.stories
    where expires_at < p_now - interval '7 days'
    returning id
  )
  select count(*) into v_deleted_stories from deleted;

  return jsonb_build_object(
    'notification_jobs_sent_cancelled', coalesce(v_deleted_jobs_sent, 0),
    'notification_jobs_failed', coalesce(v_deleted_jobs_failed, 0),
    'notifications', coalesce(v_deleted_notifications, 0),
    'stories', coalesce(v_deleted_stories, 0)
  );
end;
$$;

create or replace function public.invoke_process_notification_jobs(
  p_limit integer default 100
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_limit integer;
  v_request_id bigint;
begin
  select value
    into v_url
  from public.runtime_settings
  where key = 'process_notification_jobs_url';

  if v_url is null or btrim(v_url) = '' then
    raise notice 'runtime setting process_notification_jobs_url is not configured; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 500);

  select net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('limit', v_limit, 'mode', 'due')
  )
    into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.invoke_notification_review_backfill(
  p_limit integer default 100
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_limit integer;
  v_request_id bigint;
begin
  select value
    into v_url
  from public.runtime_settings
  where key = 'process_notification_jobs_url';

  if v_url is null or btrim(v_url) = '' then
    raise notice 'runtime setting process_notification_jobs_url is not configured; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 500);

  select net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('limit', v_limit, 'mode', 'review_backfill')
  )
    into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.invoke_notification_weekly_recaps(
  p_limit integer default 500
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_limit integer;
  v_request_id bigint;
begin
  select value
    into v_url
  from public.runtime_settings
  where key = 'process_notification_jobs_url';

  if v_url is null or btrim(v_url) = '' then
    raise notice 'runtime setting process_notification_jobs_url is not configured; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 500), 1), 1000);

  select net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('limit', v_limit, 'mode', 'weekly_recaps')
  )
    into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.invoke_notification_retention_cleanup()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_request_id bigint;
begin
  select value
    into v_url
  from public.runtime_settings
  where key = 'process_notification_jobs_url';

  if v_url is null or btrim(v_url) = '' then
    raise notice 'runtime setting process_notification_jobs_url is not configured; skipping';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"mode":"cleanup"}'::jsonb
  )
    into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.cleanup_notification_retention(timestamptz) to postgres, service_role;
grant execute on function public.invoke_process_notification_jobs(integer) to postgres, service_role;
grant execute on function public.invoke_notification_review_backfill(integer) to postgres, service_role;
grant execute on function public.invoke_notification_weekly_recaps(integer) to postgres, service_role;
grant execute on function public.invoke_notification_retention_cleanup() to postgres, service_role;

revoke all on function public.cleanup_notification_retention(timestamptz) from public, anon, authenticated;
revoke all on function public.invoke_process_notification_jobs(integer) from public, anon, authenticated;
revoke all on function public.invoke_notification_review_backfill(integer) from public, anon, authenticated;
revoke all on function public.invoke_notification_weekly_recaps(integer) from public, anon, authenticated;
revoke all on function public.invoke_notification_retention_cleanup() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname in (
      'process-notification-jobs-every-10-min',
      'process-notification-due-hourly',
      'process-notification-review-backfill-every-8-hours',
      'process-notification-weekly-recaps',
      'process-notification-retention-cleanup-daily'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'process-notification-due-hourly',
  '0 * * * *',
  $$select public.invoke_process_notification_jobs(200);$$
);

select cron.schedule(
  'process-notification-review-backfill-every-8-hours',
  '0 */8 * * *',
  $$select public.invoke_notification_review_backfill(200);$$
);

select cron.schedule(
  'process-notification-weekly-recaps',
  '0 9 * * 1',
  $$select public.invoke_notification_weekly_recaps(500);$$
);

select cron.schedule(
  'process-notification-retention-cleanup-daily',
  '15 3 * * *',
  $$select public.invoke_notification_retention_cleanup();$$
);
