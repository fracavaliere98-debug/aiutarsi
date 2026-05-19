-- gamification_state: existing policy allowed any authenticated user to read
-- any other user's XP, level, badges. Replace with own-row access only.
-- NPO profile screens that need to display a volunteer's level read from the
-- profiles table (xp/level/badges are synced there by trigger), not from
-- gamification_state directly, so this restriction does not break the UI.

drop policy if exists "Authenticated users can view all gamification states" on public.gamification_state;

create policy "Users view own gamification state"
on public.gamification_state
for select
to authenticated
using (user_id = auth.uid());
