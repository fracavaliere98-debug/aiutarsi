create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.runtime_settings (
  key text primary key,
  value text null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_runtime_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_runtime_settings_updated_at on public.runtime_settings;
create trigger trg_runtime_settings_updated_at
before update on public.runtime_settings
for each row
execute function public.set_runtime_settings_updated_at();

alter table public.runtime_settings enable row level security;

drop policy if exists "runtime_settings service role only" on public.runtime_settings;
create policy "runtime_settings service role only"
on public.runtime_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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
    body := jsonb_build_object('limit', v_limit)
  )
    into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.invoke_process_notification_jobs(integer) to postgres, service_role;

do $$
declare
  v_job_id bigint;
  v_existing_url text;
begin
  select (regexp_match(command, '(https://[^''\\s]+)'))[1]
    into v_existing_url
  from cron.job
  where jobname = 'process-notification-jobs-every-10-min'
  order by jobid desc
  limit 1;

  insert into public.runtime_settings (key, value, description)
  values (
    'process_notification_jobs_url',
    v_existing_url,
    'Edge Function URL used by pg_cron to process queued notification jobs.'
  )
  on conflict (key) do update
    set value = coalesce(excluded.value, public.runtime_settings.value),
        description = excluded.description;

  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'process-notification-jobs-every-10-min'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'process-notification-jobs-every-10-min',
  '*/10 * * * *',
  $$select public.invoke_process_notification_jobs(100);$$
);
