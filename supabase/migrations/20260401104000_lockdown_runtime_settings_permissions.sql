revoke all on function public.invoke_process_notification_jobs(integer) from anon, authenticated;
grant execute on function public.invoke_process_notification_jobs(integer) to service_role;

revoke all on table public.runtime_settings from anon, authenticated;
grant all on table public.runtime_settings to service_role;
