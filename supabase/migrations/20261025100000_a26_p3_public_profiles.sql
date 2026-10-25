-- A26 P3: profili pubblici con regole di visibilita' + lettura del proprio profilo.
-- Additiva: non toglie nessun permesso (la revoca delle colonne sensibili e' P2, dopo il cambio del client).
--
-- get_public_profiles(p_ids, p_role, p_limit, p_offset): restituisce solo colonne ammesse, secondo chi guarda:
--   self/admin  -> profilo completo, email compresa
--   NPO/CORPORATE come bersaglio -> profilo pubblico dell'organizzazione
--   volontario con volunteer_list_visible -> completo per volontari ed enti VERIFICATI
--   volontario non pubblico -> completo solo per un ente verificato con cui ha agito
--     (candidatura, iscrizione a un'attivita' non annullata, risposta in chat) e per volontari
--     con candidatura APPROVATA nella stessa organizzazione; altrimenti 'limited'
--     (nome e iniziale, livello, niente avatar)
--   ente NON verificato -> nessun profilo di volontari
-- Telefono dei volontari: mai da qui. Email del volontario: solo se ha acceso show_email e solo all'ente
-- (verificato) a cui appartiene (candidatura APPROVATA); mai ad altri volontari.

drop function if exists public.get_public_profiles(uuid[], public.user_role, integer);
drop function if exists public.get_public_profiles(uuid[], public.user_role, integer, integer);

create or replace function public.get_public_profiles(
  p_ids uuid[] default null,
  p_role public.user_role default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  profile_id uuid, role public.user_role, access text, display_name text, avatar_url text, bio text,
  location_string text, location_lat double precision, location_lng double precision,
  impact_points integer, level integer, badges jsonb, skills text[], interests text[],
  show_volunteering_history boolean, last_seen_at timestamptz,
  is_verified boolean, npo_name text, company_name text, website text, npo_website text,
  public_email text, email text, phone text, allow_calls boolean,
  referent_name text, referent_role text, referent_avatar_url text, sought_skills text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with me as (
    select p.id, p.role, coalesce(p.is_verified, false) as verified
    from public.profiles p
    where p.id = auth.uid()
  ),
  cand as (
    select p.*, me.id as vid, me.role as vrole, me.verified as vverified
    from public.profiles p
    cross join me
    where (p_ids is null or p.id = any(p_ids))
      and (p_role is null or p.role = p_role)
      and (p.role <> 'ADMIN' or p.id = me.id or me.role = 'ADMIN')
  ),
  acc as (
    select c.*,
      case
        when c.id = c.vid then 'self'
        when c.vrole = 'ADMIN' then 'admin'
        when c.role in ('NPO', 'CORPORATE') then 'full'
        when c.role = 'ADMIN' then 'none'
        when c.vrole = 'NPO' and not c.vverified then 'none'
        when coalesce(c.volunteer_list_visible, true) then 'full'
        when c.vrole = 'NPO' and (
          exists (select 1 from public.applications a where a.npo_id = c.vid and a.volunteer_id = c.id)
          or exists (
            select 1 from public.activity_participants ap
            join public.activities ac on ac.id = ap.activity_id
            where ac.npo_id = c.vid and ap.user_id = c.id and ap.status not in ('CANCELLED', 'REJECTED')
          )
          or exists (
            select 1 from public.messages m
            join public.conversations cv on cv.id = m.conversation_id and cv.type = 'PRIVATE'
            join public.conversation_participants cp on cp.conversation_id = cv.id and cp.user_id = c.vid
            where m.sender_id = c.id
          )
        ) then 'full'
        when c.vrole in ('VOLUNTEER', 'CORPORATE') and exists (
          select 1 from public.applications a1
          join public.applications a2 on a2.npo_id = a1.npo_id
          where a1.volunteer_id = c.vid and a2.volunteer_id = c.id
            and a1.status = 'APPROVED' and a2.status = 'APPROVED'
        ) then 'full'
        else 'limited'
      end as access
    from cand c
  )
  select
    a.id,
    a.role,
    a.access,
    case when a.access <> 'limited' then a.full_name
      when position(' ' in trim(coalesce(a.full_name, ''))) > 0
        then split_part(trim(a.full_name), ' ', 1) || ' ' || upper(left(regexp_replace(trim(a.full_name), '^.*\s', ''), 1)) || '.'
      else coalesce(nullif(trim(a.full_name), ''), 'Volontario') end,
    case when a.access <> 'limited' then a.avatar_url end,
    case when a.access <> 'limited' then a.bio end,
    case when a.access <> 'limited' then a.location_string end,
    case when a.access <> 'limited' and a.role in ('NPO', 'CORPORATE') then a.location_lat end,
    case when a.access <> 'limited' and a.role in ('NPO', 'CORPORATE') then a.location_lng end,
    case when a.access <> 'limited' then a.impact_points end,
    coalesce((select g.level from public.gamification_state g where g.user_id = a.id), 1),
    case when a.access <> 'limited' then a.badges end,
    case when a.access <> 'limited' then array(select us.skill from public.user_skills us where us.user_id = a.id) else '{}'::text[] end,
    case when a.access <> 'limited' then array(select ui.interest from public.user_interests ui where ui.user_id = a.id) else '{}'::text[] end,
    case when a.access <> 'limited' then a.show_volunteering_history end,
    case when a.access <> 'limited' then a.last_seen_at end,
    a.is_verified,
    case when a.role = 'NPO' then a.npo_name end,
    case when a.role = 'CORPORATE' then a.company_name end,
    case when a.role in ('NPO', 'CORPORATE') then a.website end,
    case when a.role = 'NPO' then a.npo_website end,
    case when a.role in ('NPO', 'CORPORATE') then a.public_email end,
    case when a.access in ('self', 'admin')
      or (a.vrole = 'NPO' and a.role = 'VOLUNTEER' and coalesce(a.show_email, false)
          and exists (select 1 from public.applications ap where ap.npo_id = a.vid and ap.volunteer_id = a.id and ap.status = 'APPROVED'))
      then a.email end,
    case when a.role in ('NPO', 'CORPORATE') then a.phone end,
    case when a.role in ('NPO', 'CORPORATE') then a.allow_calls end,
    case when a.role = 'NPO' then a.referent_name end,
    case when a.role = 'NPO' then a.referent_role end,
    case when a.role = 'NPO' then a.referent_avatar_url end,
    case when a.role = 'NPO' then a.sought_skills end,
    a.created_at
  from acc a
  where a.access <> 'none'
  order by a.full_name nulls last, a.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_public_profiles(uuid[], public.user_role, integer, integer) from public, anon;
grant execute on function public.get_public_profiles(uuid[], public.user_role, integer, integer) to authenticated;

-- Il proprio profilo completo (tranne embedding): serve quando P2 togliera' la lettura diretta delle colonne sensibili.
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select to_jsonb(p) - 'embedding' from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- Profilo completo di un utente, solo per admin (schermata di verifica degli enti: partita IVA, indirizzo, documento).
create or replace function public.admin_get_profile(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when public.is_current_user_admin() then to_jsonb(p) - 'embedding' end
  from public.profiles p
  where p.id = p_id;
$$;

revoke all on function public.admin_get_profile(uuid) from public, anon;
grant execute on function public.admin_get_profile(uuid) to authenticated;
