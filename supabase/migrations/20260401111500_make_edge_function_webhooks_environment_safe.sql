create or replace function public.build_edge_function_url(
  p_function_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
begin
  select value
    into v_base_url
  from public.runtime_settings
  where key = 'functions_base_url';

  if v_base_url is null or btrim(v_base_url) = '' then
    return null;
  end if;

  v_base_url := regexp_replace(v_base_url, '/+$', '');
  return v_base_url || '/' || trim(both '/' from coalesce(p_function_name, ''));
end;
$$;

grant execute on function public.build_edge_function_url(text) to postgres, service_role;
revoke all on function public.build_edge_function_url(text) from anon, authenticated;

do $$
declare
  v_base_url text;
begin
  select regexp_replace(value, '/process-notification-jobs/?$', '')
    into v_base_url
  from public.runtime_settings
  where key = 'process_notification_jobs_url';

  insert into public.runtime_settings (key, value, description)
  values (
    'functions_base_url',
    v_base_url,
    'Base URL for Supabase Edge Functions, without trailing slash.'
  )
  on conflict (key) do update
    set value = coalesce(excluded.value, public.runtime_settings.value),
        description = excluded.description;
end;
$$;

create or replace function public.call_check_activity_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  service_role_key text;
  v_url text;
begin
  service_role_key := current_setting('app.settings.service_role_key', true);
  v_url := public.build_edge_function_url('check-new-activity-matches');

  if service_role_key is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(new)),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

create or replace function public.call_generate_embedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  service_role_key text;
  v_url text;
begin
  service_role_key := current_setting('app.settings.service_role_key', true);
  v_url := public.build_edge_function_url('generate-embedding');

  if service_role_key is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'table', tg_table_name,
      'schema', tg_table_schema
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

create or replace function public.invoke_push_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  v_url := public.build_edge_function_url('push-notifications');
  if v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := json_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', row_to_json(new)
    )::jsonb
  );

  return new;
end;
$$;

create or replace function public.on_activity_change_for_embedding()
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
  v_url := public.build_edge_function_url('generate-embedding');

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
      'table', tg_table_name,
      'type', tg_op
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

create or replace function public.on_notification_inserted()
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
  v_url := public.build_edge_function_url('notify-user');

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
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public'
    )
  );

  return new;
end;
$$;

create or replace function public.on_profile_change_for_embedding()
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
  v_url := public.build_edge_function_url('generate-embedding');

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
      'table', tg_table_name,
      'type', tg_op
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

create or replace function public.on_skill_change_for_embedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record record;
  v_secret text;
  v_url text;
begin
  select * into profile_record from public.profiles where id = coalesce(new.user_id, old.user_id);
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('generate-embedding');

  if profile_record is not null and v_url is not null then
    perform net.http_post(
      url := v_url,
      headers := case
        when v_secret is null then jsonb_build_object('Content-Type', 'application/json')
        else jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_secret
        )
      end,
      body := jsonb_build_object(
        'table', 'profiles',
        'record', row_to_json(profile_record),
        'type', 'UPDATE'
      )
    );
  end if;

  return coalesce(new, old);
end;
$$;

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
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists "moderation-webhook" on public.community_posts;
create trigger "moderation-webhook"
after insert on public.community_posts
for each row
execute function public.invoke_community_moderator_webhook();

revoke all on function public.build_edge_function_url(text) from anon, authenticated;
grant execute on function public.build_edge_function_url(text) to service_role;

revoke all on function public.call_check_activity_matches() from anon, authenticated;
grant execute on function public.call_check_activity_matches() to service_role;

revoke all on function public.call_generate_embedding() from anon, authenticated;
grant execute on function public.call_generate_embedding() to service_role;

revoke all on function public.invoke_push_notification_webhook() from anon, authenticated;
grant execute on function public.invoke_push_notification_webhook() to service_role;

revoke all on function public.on_activity_change_for_embedding() from anon, authenticated;
grant execute on function public.on_activity_change_for_embedding() to service_role;

revoke all on function public.on_notification_inserted() from anon, authenticated;
grant execute on function public.on_notification_inserted() to service_role;

revoke all on function public.on_profile_change_for_embedding() from anon, authenticated;
grant execute on function public.on_profile_change_for_embedding() to service_role;

revoke all on function public.on_skill_change_for_embedding() from anon, authenticated;
grant execute on function public.on_skill_change_for_embedding() to service_role;

revoke all on function public.invoke_community_moderator_webhook() from anon, authenticated;
grant execute on function public.invoke_community_moderator_webhook() to service_role;
