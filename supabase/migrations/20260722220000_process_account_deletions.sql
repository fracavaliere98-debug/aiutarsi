-- Closes the account-deletion flow: requestAccountDeletion() only ever set
-- profiles.deletion_requested_at; nothing processed it afterwards. The cron
-- job that was supposed to (process-account-deletions-nightly, staging only)
-- called an edge function that was never built, using an Authorization
-- header built from current_setting('app.settings.service_role_key', true),
-- which is unset on this project (verified null) -- so it was broken twice
-- over even before the missing function is accounted for.
--
-- Two FKs into profiles were ON DELETE NO ACTION, which would make
-- auth.admin.deleteUser() fail for any user who ever received a notification
-- log entry or referred another user (i.e. most real accounts). Relaxed both
-- to ON DELETE SET NULL. admin_audit_logs.admin_id is deliberately left as
-- NO ACTION: it protects the audit trail, and admin accounts are not
-- expected to self-delete through the regular volunteer/NPO settings flow.

alter table public.profiles
  drop constraint if exists profiles_referred_by_fkey,
  add constraint profiles_referred_by_fkey
    foreign key (referred_by) references public.profiles(id) on delete set null;

alter table public.notification_logs
  drop constraint if exists notification_logs_user_id_fkey,
  add constraint notification_logs_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

-- Environment-safe invoker, following the same pattern already used by the
-- community-moderator-ai / generate-embedding / notify-user webhooks
-- (public.build_edge_function_url() + public.internal_secrets), not the
-- older app.settings.service_role_key GUC used by the old broken cron.
create or replace function public.invoke_process_account_deletions(
  p_limit integer default 200
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
  v_url := public.build_edge_function_url('process-account-deletions');
  select value into v_secret from public.internal_secrets where key = 'service_role_key';

  if v_url is null or v_secret is null then
    raise notice 'invoke_process_account_deletions: missing edge function url or service role secret; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 200), 1), 500);

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('limit', v_limit)
  )
    into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.invoke_process_account_deletions(integer) to postgres, service_role;

-- Replace the old broken job (raw net.http_post pointing at staging only,
-- dead auth header) with the wrapper-function cron, and create it on
-- production too -- it never existed there because the edge function it
-- called was never deployed.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'process-account-deletions-nightly'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'process-account-deletions-nightly',
  '0 3 * * *',
  $$select public.invoke_process_account_deletions(200);$$
);
