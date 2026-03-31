create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job_id bigint;
begin
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
  $$
  select
    net.http_post(
      url := 'https://pavnfiladmnwbptwlwpr.supabase.co/functions/v1/process-notification-jobs',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"limit":100}'::jsonb
    );
  $$
);
