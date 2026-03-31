create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  related_activity_id uuid null references public.activities(id) on delete cascade,
  related_conversation_id uuid null references public.conversations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  sent_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_status_check check (status in ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  constraint notification_jobs_dedupe_key_unique unique (dedupe_key)
);

create index if not exists idx_notification_jobs_status_scheduled_for
  on public.notification_jobs(status, scheduled_for);

create index if not exists idx_notification_jobs_user_id
  on public.notification_jobs(user_id);

create or replace function public.set_notification_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_jobs_updated_at on public.notification_jobs;
create trigger trg_notification_jobs_updated_at
before update on public.notification_jobs
for each row
execute function public.set_notification_jobs_updated_at();

alter table public.notification_jobs enable row level security;

drop policy if exists "notification_jobs service role only" on public.notification_jobs;
create policy "notification_jobs service role only"
on public.notification_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
