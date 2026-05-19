create or replace function public.invoke_community_moderator_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('community-moderator-ai');

  if v_secret is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema
    )::jsonb,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.invoke_community_moderator_webhook() from anon, authenticated;
grant execute on function public.invoke_community_moderator_webhook() to service_role;
