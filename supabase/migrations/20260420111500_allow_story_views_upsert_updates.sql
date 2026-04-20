drop policy if exists "Users can update their own story views" on public.story_views;
create policy "Users can update their own story views"
on public.story_views
for update
to authenticated
using (viewer_user_id = auth.uid())
with check (viewer_user_id = auth.uid());
