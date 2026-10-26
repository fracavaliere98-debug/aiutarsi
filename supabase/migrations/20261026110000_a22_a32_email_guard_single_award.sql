-- A22 + A32 (2026-10-26), secondo giro.
--
-- A22: email ed email_confirmed del profilo sono una copia di auth.users: le scrivono solo
-- handle_new_user (iscrizione) e sync_profile_email_confirmation (cambio/conferma email), entrambe
-- eseguite da Supabase Auth senza token utente. Il trigger di protezione decide con auth.role(),
-- quindi le bloccherebbe: le due funzioni impostano ora app.bypass_profile_guard e il trigger
-- protegge anche email ed email_confirmed (il client non le scrive: AuthService le esclude).
-- In piu': sync_profile_email_confirmation, se il profilo non esisteva, lo creava col ruolo preso
-- dai metadata SENZA filtro (anche ADMIN). Ora usa la stessa regola dell'iscrizione.
--
-- A32 / D06 (XP e badge solo dopo la conferma di presenza dell'ente): la migration del 21/09 ha tolto
-- solo il trigger su APPROVED. Restavano on_checkin_gamification (premi a CHECKED_IN, impostabile
-- dall'ente via API) e trg_activity_completion_gamification (premi ai CHECKED_IN a fine attivita'),
-- che usavano una seconda versione di award_activity_completion_to_user senza il premio invito.
-- Nessun codice dell'app scrive CHECKED_IN (0 righe su staging). Resta una sola strada:
-- on_volunteer_attendance_confirmed -> award_activity_completion_to_user(uuid, activities).

create or replace function public.sync_profile_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  v_role := case upper(coalesce(new.raw_user_meta_data->>'role', ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;

  perform set_config('app.bypass_profile_guard', 'true', true);
  insert into public.profiles (id, email, email_confirmed, role, referral_code, updated_at)
  values (new.id, new.email, coalesce(new.email_confirmed_at is not null, false), v_role,
          public.generate_referral_code(new.id), now())
  on conflict (id) do update
  set email = excluded.email,
      email_confirmed = excluded.email_confirmed,
      updated_at = now();
  perform set_config('app.bypass_profile_guard', 'false', true);

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  v_role := case upper(coalesce(new.raw_user_meta_data->>'role', ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;

  perform set_config('app.bypass_profile_guard', 'true', true);
  insert into public.profiles (id,email,email_confirmed,full_name,avatar_url,role,npo_name,company_name,npo_vat_id,referral_code)
  values (new.id,new.email,coalesce(new.email_confirmed_at is not null,false),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'displayName'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar'),
    v_role,
    coalesce(new.raw_user_meta_data->>'npo_name', new.raw_user_meta_data->>'npoName'),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName'),
    new.raw_user_meta_data->>'npo_vat_id', public.generate_referral_code(new.id))
  on conflict (id) do update set email = excluded.email, email_confirmed = excluded.email_confirmed, updated_at = now();
  perform set_config('app.bypass_profile_guard', 'false', true);
  return new;
end;
$$;

create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and coalesce(current_setting('app.bypass_profile_guard', true), 'false') is distinct from 'true' then
    new.is_verified := old.is_verified;
    new.impact_points := old.impact_points;
    new.verification_status := old.verification_status;
    new.role := old.role;
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.ban_report_id := old.ban_report_id;
    new.created_at := old.created_at;
    new.badges := old.badges;
    new.referred_by := old.referred_by;
    new.referral_code := old.referral_code;
    new.email := old.email;
    new.email_confirmed := old.email_confirmed;
  end if;
  return new;
end;
$$;

-- D06: una sola strada per XP e badge di fine attivita'.
drop trigger if exists on_checkin_gamification on public.activity_participants;
drop trigger if exists trg_activity_completion_gamification on public.activities;
drop function if exists public.handle_checkin_gamification();
drop function if exists public.handle_activity_completion_gamification();
drop function if exists public.award_activity_completion_to_user(uuid, record);
