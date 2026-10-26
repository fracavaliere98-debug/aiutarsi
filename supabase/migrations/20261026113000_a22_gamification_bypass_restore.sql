-- A22 (2026-10-26): sync_gamification_to_profile accendeva app.bypass_profile_guard e non lo spegneva:
-- per il resto della transazione il trigger dei campi protetti era disattivato (VERIFIED su staging:
-- dopo award_gamification_xp il valore restava 'true'). Ora ripristina il valore precedente, cosi'
-- non spegne nemmeno l'eccezione di una funzione esterna che la sta usando.
create or replace function public.sync_gamification_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_prev text := coalesce(current_setting('app.bypass_profile_guard', true), 'false');
begin
  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.profiles
  set impact_points = new.xp,
      badges = new.badges
  where id = new.user_id;
  perform set_config('app.bypass_profile_guard', v_prev, true);
  return new;
end;
$$;
