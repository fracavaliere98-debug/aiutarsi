create table if not exists public.story_metrics_daily (
  author_id uuid not null references public.profiles(id) on delete cascade,
  metric_date date not null,
  stories_count integer not null default 0 check (stories_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (author_id, metric_date)
);

create or replace function public.set_story_metrics_daily_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_story_metrics_daily_updated_at on public.story_metrics_daily;
create trigger trg_story_metrics_daily_updated_at
before update on public.story_metrics_daily
for each row
execute function public.set_story_metrics_daily_updated_at();

create or replace function public.increment_story_metrics_daily_on_story_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.story_metrics_daily (author_id, metric_date, stories_count)
  values (
    new.author_id,
    (coalesce(new.created_at, now()) at time zone 'utc')::date,
    1
  )
  on conflict (author_id, metric_date) do update
    set stories_count = public.story_metrics_daily.stories_count + 1,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_story_metrics_daily_on_story_insert on public.stories;
create trigger trg_story_metrics_daily_on_story_insert
after insert on public.stories
for each row
execute function public.increment_story_metrics_daily_on_story_insert();

insert into public.story_metrics_daily (author_id, metric_date, stories_count)
select
  author_id,
  (coalesce(created_at, now()) at time zone 'utc')::date as metric_date,
  count(*)::integer as stories_count
from public.stories
group by author_id, metric_date
on conflict (author_id, metric_date) do update
  set stories_count = excluded.stories_count,
      updated_at = now();

alter table public.story_metrics_daily enable row level security;

drop policy if exists "Users can view their own story metrics" on public.story_metrics_daily;
create policy "Users can view their own story metrics"
on public.story_metrics_daily
for select
to authenticated
using (auth.uid() = author_id);

grant select on public.story_metrics_daily to authenticated;
grant all on public.story_metrics_daily to service_role;
grant execute on function public.set_story_metrics_daily_updated_at() to service_role;
grant execute on function public.increment_story_metrics_daily_on_story_insert() to service_role;
