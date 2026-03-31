create table if not exists public.notification_rate_limits (
  scope_key text primary key,
  job_type text not null,
  window_seconds integer not null,
  last_sent_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_rate_limits_job_type
  on public.notification_rate_limits(job_type);

create or replace function public.set_notification_rate_limits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_rate_limits_updated_at on public.notification_rate_limits;
create trigger trg_notification_rate_limits_updated_at
before update on public.notification_rate_limits
for each row
execute function public.set_notification_rate_limits_updated_at();

create or replace function public.try_consume_notification_rate_limit(
  p_scope_key text,
  p_job_type text,
  p_window_seconds integer,
  p_now timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_sent_at timestamptz;
begin
  loop
    select last_sent_at
      into v_last_sent_at
    from public.notification_rate_limits
    where scope_key = p_scope_key
    for update;

    if not found then
      begin
        insert into public.notification_rate_limits (
          scope_key,
          job_type,
          window_seconds,
          last_sent_at,
          metadata
        ) values (
          p_scope_key,
          p_job_type,
          p_window_seconds,
          p_now,
          coalesce(p_metadata, '{}'::jsonb)
        );
        return true;
      exception
        when unique_violation then
      end;
    elsif v_last_sent_at + make_interval(secs => p_window_seconds) > p_now then
      return false;
    else
      update public.notification_rate_limits
         set job_type = p_job_type,
             window_seconds = p_window_seconds,
             last_sent_at = p_now,
             metadata = coalesce(p_metadata, '{}'::jsonb)
       where scope_key = p_scope_key;
      return true;
    end if;
  end loop;
end;
$$;

grant execute on function public.try_consume_notification_rate_limit(text, text, integer, timestamptz, jsonb) to service_role;

alter table public.notification_rate_limits enable row level security;

drop policy if exists "notification_rate_limits service role only" on public.notification_rate_limits;
create policy "notification_rate_limits service role only"
on public.notification_rate_limits
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
