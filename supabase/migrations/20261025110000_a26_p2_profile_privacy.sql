-- A26 P2: privacy dei profili a livello di database.
-- Prerequisito: P3 (get_public_profiles, get_my_profile, admin_get_profile) e P4 (client che le usa).
--
-- 1) ensure_my_profile(): crea/completa il proprio profilo dal client senza decidere ruolo ed email.
-- 2) profile_access_level(): stessa regola di get_public_profiles, in forma leggera per le policy di riga.
--    ('self' | 'admin' | 'full' | 'limited' | 'none'). Tenerla allineata a get_public_profiles.
-- 3) Righe: un utente legge una riga di profiles solo se la puo' vedere per intero (self/admin/full) oppure
--    condivide una conversazione con quella persona (servono nome e avatar nella chat).
--    I volontari non pubblici compaiono abbreviati solo tramite get_public_profiles.
-- 4) Colonne: tolte agli utenti loggati email, telefono, data di nascita, genere, posizione precisa,
--    indirizzo, push token, embedding, dati di ban, partita IVA, documento di verifica, ecc.
--    Il proprio profilo si legge con get_my_profile(); l'admin con admin_get_profile().
-- 5) user_skills e user_interests: non piu' leggibili da tutti, ma con la stessa regola delle righe.
-- 6) anon non ha piu' alcun permesso su profiles; l'INSERT diretto dal client e' tolto (il profilo nasce
--    dal trigger handle_new_user o da ensure_my_profile).

-- 1) ---------------------------------------------------------------------------------------------
create or replace function public.ensure_my_profile(
  p_role text default null,
  p_full_name text default null,
  p_npo_name text default null,
  p_company_name text default null,
  p_avatar_url text default null,
  p_profile_completed boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  v_role := case upper(coalesce(p_role, ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;
  insert into public.profiles (id, email, full_name, avatar_url, role, npo_name, company_name, profile_completed, referral_code)
  values (v_uid, v_email, p_full_name, p_avatar_url, v_role, p_npo_name, p_company_name, coalesce(p_profile_completed, false), substring(v_uid::text, 1, 8))
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    npo_name = coalesce(public.profiles.npo_name, excluded.npo_name),
    company_name = coalesce(public.profiles.company_name, excluded.company_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
end;
$$;
revoke all on function public.ensure_my_profile(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.ensure_my_profile(text, text, text, text, text, boolean) to authenticated;

-- 2) ---------------------------------------------------------------------------------------------
create or replace function public.profile_access_level(p_target uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with me as (
    select p.id, p.role, coalesce(p.is_verified, false) as verified from public.profiles p where p.id = auth.uid()
  ), t as (
    select p.id, p.role, p.volunteer_list_visible from public.profiles p where p.id = p_target
  )
  select case
    when not exists (select 1 from me) or not exists (select 1 from t) then 'none'
    when (select id from t) = (select id from me) then 'self'
    when (select role from me) = 'ADMIN' then 'admin'
    when (select role from t) in ('NPO', 'CORPORATE') then 'full'
    when (select role from t) = 'ADMIN' then 'none'
    when (select role from me) = 'NPO' and not (select verified from me) then 'none'
    when coalesce((select volunteer_list_visible from t), true) then 'full'
    when (select role from me) = 'NPO' and (
      exists (select 1 from public.applications a where a.npo_id = (select id from me) and a.volunteer_id = p_target)
      or exists (
        select 1 from public.activity_participants ap join public.activities ac on ac.id = ap.activity_id
        where ac.npo_id = (select id from me) and ap.user_id = p_target and ap.status not in ('CANCELLED', 'REJECTED')
      )
      or exists (
        select 1 from public.messages m
        join public.conversations cv on cv.id = m.conversation_id and cv.type = 'PRIVATE'
        join public.conversation_participants cp on cp.conversation_id = cv.id and cp.user_id = (select id from me)
        where m.sender_id = p_target
      )
    ) then 'full'
    when (select role from me) in ('VOLUNTEER', 'CORPORATE') and exists (
      select 1 from public.applications a1 join public.applications a2 on a2.npo_id = a1.npo_id
      where a1.volunteer_id = (select id from me) and a2.volunteer_id = p_target and a1.status = 'APPROVED' and a2.status = 'APPROVED'
    ) then 'full'
    else 'limited'
  end;
$$;
revoke all on function public.profile_access_level(uuid) from public, anon;
grant execute on function public.profile_access_level(uuid) to authenticated;

create or replace function public.can_view_profile_row(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.profile_access_level(p_target) in ('self', 'admin', 'full')
    or exists (
      select 1 from public.conversation_participants a
      join public.conversation_participants b on b.conversation_id = a.conversation_id
      where a.user_id = auth.uid() and b.user_id = p_target
    );
$$;
revoke all on function public.can_view_profile_row(uuid) from public, anon;
grant execute on function public.can_view_profile_row(uuid) to authenticated;

-- 3) righe ---------------------------------------------------------------------------------------
drop policy if exists "Profiles select access" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Profiles select visible" on public.profiles for select to authenticated
  using (public.can_view_profile_row(id));

-- 4) colonne + INSERT + anon ---------------------------------------------------------------------
revoke all on table public.profiles from anon;
revoke select, insert on table public.profiles from authenticated;
grant select (
  id, role, full_name, avatar_url, bio, impact_points, location_string, is_verified, profile_completed,
  npo_name, website, public_email, company_name, created_at, updated_at, last_seen_at, allow_calls,
  profile_public, show_email, volunteer_list_visible, show_volunteering_history, badges, npo_website,
  referent_name, referent_role, referent_avatar_url, sought_skills, verification_status,
  referral_code, referred_by
) on table public.profiles to authenticated;

-- 5) competenze e interessi ----------------------------------------------------------------------
drop policy if exists "Skills viewable by everyone" on public.user_skills;
create policy "Skills visible by profile rule" on public.user_skills for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile_row(user_id));

drop policy if exists "Interests viewable by everyone" on public.user_interests;
create policy "Interests visible by profile rule" on public.user_interests for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile_row(user_id));
