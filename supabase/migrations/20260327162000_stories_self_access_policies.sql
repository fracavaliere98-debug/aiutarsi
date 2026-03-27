alter table if exists public.stories enable row level security;

drop policy if exists "Stories are viewable by authenticated users" on public.stories;
create policy "Stories are viewable by authenticated users"
on public.stories
for select
to authenticated
using (true);

drop policy if exists "Users can create their own stories" on public.stories;
create policy "Users can create their own stories"
on public.stories
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "Users can update their own stories" on public.stories;
create policy "Users can update their own stories"
on public.stories
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories"
on public.stories
for delete
to authenticated
using (author_id = auth.uid());
