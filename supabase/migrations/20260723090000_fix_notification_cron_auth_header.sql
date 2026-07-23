-- The four notification-pipeline cron invokers created in
-- 20260401101500_make_notification_cron_environment_safe.sql build the
-- net.http_post headers with only Content-Type, never Authorization -- even
-- though the process-notification-jobs edge function has verify_jwt=true.
-- Confirmed broken in production: the hourly cron run on 2026-07-22 21:00
-- UTC returned 401 UNAUTHORIZED_NO_AUTH_HEADER. This has been silently
-- dropping queued notification jobs (rate-limited/deduped notifications,
-- weekly NPO/volunteer recaps, review-reminder fallbacks, retention cleanup)
-- since April 1st on both prod and staging -- same missing-header bug as the
-- one fixed for account deletions in 20260722220000_process_account_deletions.sql.
--
-- Fix: add the Authorization header sourced from public.internal_secrets,
-- same pattern used by the already-correct community-moderator-ai /
-- generate-embedding / notify-user webhooks and by
-- invoke_process_account_deletions(). URL lookup via runtime_settings is
-- left untouched -- it was never the problem.

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
  v_secret text;
  v_limit integer;
  v_request_id bigint;
begin
  select value into v_url from public.runtime_settings where key = 'process_notification_jobs_url';
  select value into v_secret from public.internal_secrets where key = 'service_role_key';

  if v_url is null or btrim(v_url) = '' or v_secret is null then
    raise notice 'invoke_process_notification_jobs: missing url or service role secret; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 500);

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
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
  v_secret text;
  v_limit integer;
  v_request_id bigint;
begin
  select value into v_url from public.runtime_settings where key = 'process_notification_jobs_url';
  select value into v_secret from public.internal_secrets where key = 'service_role_key';

  if v_url is null or btrim(v_url) = '' or v_secret is null then
    raise notice 'invoke_notification_review_backfill: missing url or service role secret; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 500);

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
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
  v_secret text;
  v_limit integer;
  v_request_id bigint;
begin
  select value into v_url from public.runtime_settings where key = 'process_notification_jobs_url';
  select value into v_secret from public.internal_secrets where key = 'service_role_key';

  if v_url is null or btrim(v_url) = '' or v_secret is null then
    raise notice 'invoke_notification_weekly_recaps: missing url or service role secret; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 500), 1), 1000);

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
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
  v_secret text;
  v_request_id bigint;
begin
  select value into v_url from public.runtime_settings where key = 'process_notification_jobs_url';
  select value into v_secret from public.internal_secrets where key = 'service_role_key';

  if v_url is null or btrim(v_url) = '' or v_secret is null then
    raise notice 'invoke_notification_retention_cleanup: missing url or service role secret; skipping';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{"mode":"cleanup"}'::jsonb
  )
    into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.invoke_process_notification_jobs(integer) to postgres, service_role;
grant execute on function public.invoke_notification_review_backfill(integer) to postgres, service_role;
grant execute on function public.invoke_notification_weekly_recaps(integer) to postgres, service_role;
grant execute on function public.invoke_notification_retention_cleanup() to postgres, service_role;
