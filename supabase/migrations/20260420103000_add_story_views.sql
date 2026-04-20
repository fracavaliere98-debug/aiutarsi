create table if not exists public.story_views (
    story_id uuid not null references public.stories(id) on delete cascade,
    viewer_user_id uuid not null references public.profiles(id) on delete cascade,
    viewed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    primary key (story_id, viewer_user_id)
);

create index if not exists story_views_viewer_user_id_idx
    on public.story_views(viewer_user_id, viewed_at desc);

alter table public.story_views enable row level security;

drop policy if exists "Users can view their own story views" on public.story_views;
create policy "Users can view their own story views"
on public.story_views
for select
to authenticated
using (viewer_user_id = auth.uid());

drop policy if exists "Users can insert their own story views" on public.story_views;
create policy "Users can insert their own story views"
on public.story_views
for insert
to authenticated
with check (viewer_user_id = auth.uid());
