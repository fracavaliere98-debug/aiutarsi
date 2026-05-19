-- Rate limit table for AI edge function calls.
-- Tracks call count per scope_key within a rolling time window.
-- Used by gemma-help-assistant to prevent abuse of the HuggingFace API.
--
-- Limits applied in the edge function:
--   authenticated users : 30 calls / hour
--   unauthenticated (IP): 5  calls / hour

create table if not exists public.ai_call_rate_limits (
  scope_key      text        primary key,
  window_start   timestamptz not null default now(),
  call_count     integer     not null default 0,
  window_seconds integer     not null,
  max_calls      integer     not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.set_ai_call_rate_limits_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_call_rate_limits_updated_at on public.ai_call_rate_limits;
create trigger trg_ai_call_rate_limits_updated_at
before update on public.ai_call_rate_limits
for each row execute function public.set_ai_call_rate_limits_updated_at();

-- Returns true if the call is allowed (and records it), false if rate limited.
create or replace function public.try_consume_ai_rate_limit(
  p_scope_key      text,
  p_max_calls      integer,
  p_window_seconds integer,
  p_now            timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_call_count   integer;
begin
  loop
    select window_start, call_count
      into v_window_start, v_call_count
    from public.ai_call_rate_limits
    where scope_key = p_scope_key
    for update;

    if not found then
      begin
        insert into public.ai_call_rate_limits
          (scope_key, window_start, call_count, window_seconds, max_calls)
        values
          (p_scope_key, p_now, 1, p_window_seconds, p_max_calls);
        return true;
      exception when unique_violation then
        -- concurrent insert, retry loop
      end;

    elsif v_window_start + make_interval(secs => p_window_seconds) <= p_now then
      -- window expired: reset
      update public.ai_call_rate_limits
         set window_start = p_now,
             call_count   = 1,
             window_seconds = p_window_seconds,
             max_calls      = p_max_calls
       where scope_key = p_scope_key;
      return true;

    elsif v_call_count < p_max_calls then
      -- within window, under limit
      update public.ai_call_rate_limits
         set call_count = call_count + 1
       where scope_key = p_scope_key;
      return true;

    else
      -- within window, at limit
      return false;
    end if;
  end loop;
end;
$$;

-- Only service_role (used by edge functions) can read/write this table.
alter table public.ai_call_rate_limits enable row level security;

create policy "ai_call_rate_limits_service_role_only"
on public.ai_call_rate_limits
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant execute on function public.try_consume_ai_rate_limit(text, integer, integer, timestamptz)
  to service_role;
