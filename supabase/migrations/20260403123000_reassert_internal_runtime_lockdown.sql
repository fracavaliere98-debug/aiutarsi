revoke all on function public.build_edge_function_url(text) from public, anon, authenticated;
grant execute on function public.build_edge_function_url(text) to service_role;

revoke all on function public.call_generate_embedding() from public, anon, authenticated;
grant execute on function public.call_generate_embedding() to service_role;

revoke all on function public.invoke_community_moderator_webhook() from public, anon, authenticated;
grant execute on function public.invoke_community_moderator_webhook() to service_role;

revoke all on function public.invoke_process_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.invoke_process_notification_jobs(integer) to service_role;

revoke all on function public.invoke_push_notification_webhook() from public, anon, authenticated;
grant execute on function public.invoke_push_notification_webhook() to service_role;

revoke all on function public.set_runtime_settings_updated_at() from public, anon, authenticated;
grant execute on function public.set_runtime_settings_updated_at() to service_role;

revoke all on table public.internal_secrets from public, anon, authenticated;
grant all on table public.internal_secrets to service_role;

revoke all on table public.runtime_settings from public, anon, authenticated;
grant all on table public.runtime_settings to service_role;
