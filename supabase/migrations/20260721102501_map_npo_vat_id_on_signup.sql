-- Bug fix, 2026-07-21: NPO registration collected "Codice fiscale / P.IVA"
-- (`taxId`) on the signup form but never persisted it anywhere — the app
-- passed it to `supabase.auth.signUp()` as user metadata, but
-- `handle_new_user()` (the trigger that creates the `public.profiles` row on
-- signup) never read it back out, so `profiles.npo_vat_id` always started
-- NULL. The "Dettagli dell'ente" onboarding step then asked the NPO to type
-- it in again instead of showing what they had already entered.
--
-- Fix: map `npo_vat_id` from `raw_user_meta_data` into `profiles.npo_vat_id`
-- at signup time, same pattern already used here for `npo_name`/`company_name`.
-- The app-side change (passing `npo_vat_id` in the registration payload) ships
-- alongside this migration.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_referred_by_id uuid;
begin
  begin
    v_referred_by_id := (new.raw_user_meta_data->>'referred_by_id')::uuid;
  exception when others then
    v_referred_by_id := null;
  end;

  insert into public.profiles (
    id,
    email,
    email_confirmed,
    full_name,
    avatar_url,
    role,
    npo_name,
    company_name,
    npo_vat_id,
    referred_by,
    referral_code
  )
  values (
    new.id,
    new.email,
    coalesce(new.email_confirmed_at is not null, false),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'displayName'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar'),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'VOLUNTEER'::public.user_role),
    coalesce(new.raw_user_meta_data->>'npo_name', new.raw_user_meta_data->>'npoName'),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName'),
    new.raw_user_meta_data->>'npo_vat_id',
    v_referred_by_id,
    substring(new.id::text, 1, 8)
  )
  on conflict (id) do update
  set email = excluded.email,
      email_confirmed = excluded.email_confirmed,
      updated_at = now();

  return new;
end;
$function$;
