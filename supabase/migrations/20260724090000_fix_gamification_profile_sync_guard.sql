-- protect_privileged_profile_fields_trigger (added 2026-07-21) resets
-- impact_points/is_verified/verification_status back to OLD unless
-- auth.role() = 'service_role' or app.bypass_profile_guard is set. That
-- check reads request.jwt.claims, which SECURITY DEFINER does not change,
-- so this trusted internal sync (fired for any authenticated user who
-- earns XP) was being silently reverted. Bypass it here, same pattern as
-- admin_set_npo_verification.
create or replace function public.sync_gamification_to_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_catalog'
as $function$
begin
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles
    set
        impact_points = new.xp,
        badges = new.badges
    where id = new.user_id;
    return new;
end;
$function$;
