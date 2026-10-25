-- A29 + A30: contatti che il volontario sceglie di condividere con un ente.
--
-- A29: iscrizione a un'attivita' e candidatura all'ente portano una email (e, per le candidature, un telefono)
--      scelti dal volontario per quell'ente. La email del profilo non e' piu' visibile a nessun ente.
-- A30: activity_participants era leggibile da chiunque (anche senza login) con telefono e messaggio;
--      la lista iscritti dell'ente chiedeva profiles.phone, non piu' leggibile dopo A26-P3.
--
-- Regola: telefono, email e (per le iscrizioni) messaggio si leggono solo tramite get_shared_contacts_for_npo,
-- che li restituisce solo all'ente verificato destinatario e solo finche' l'iscrizione/candidatura e' valida
-- (spariscono se il volontario annulla o la candidatura e' rifiutata).

-- 1. Colonne nuove + formato.
alter table public.activity_participants add column if not exists email text;
alter table public.applications add column if not exists email text;
alter table public.applications add column if not exists phone text;

alter table public.activity_participants drop constraint if exists activity_participants_email_format;
alter table public.activity_participants
  add constraint activity_participants_email_format
  check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

alter table public.applications drop constraint if exists applications_email_format;
alter table public.applications
  add constraint applications_email_format
  check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

alter table public.applications drop constraint if exists applications_phone_length;
alter table public.applications
  add constraint applications_phone_length
  check (phone is null or length(phone) <= 30);

-- 2. Permessi per colonna: contatti e messaggio non si leggono piu' con una SELECT diretta.
revoke select on public.activity_participants from anon, authenticated;
grant select (activity_id, user_id, status, created_at) on public.activity_participants to authenticated;

revoke select on public.applications from anon, authenticated;
grant select (id, npo_id, volunteer_id, status, message, created_at, reviewed_at) on public.applications to authenticated;

-- 3. Elenco partecipanti: non piu' per utenti anonimi.
drop policy if exists "Participants viewable by everyone" on public.activity_participants;
create policy "Participants viewable by signed-in users"
  on public.activity_participants
  for select
  to authenticated
  using (true);

-- 4. Lettura per l'ente destinatario.
create or replace function public.get_shared_contacts_for_npo(
  p_volunteer_id uuid default null,
  p_activity_id uuid default null
)
returns table(
  source text,
  ref_id text,
  activity_id uuid,
  volunteer_id uuid,
  full_name text,
  avatar_url text,
  status text,
  email text,
  phone text,
  message text,
  shared_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with me as (
    select p.id
    from public.profiles p
    where p.id = auth.uid() and p.role = 'NPO' and coalesce(p.is_verified, false)
  ),
  rows_all as (
    select
      'ACTIVITY'::text as source,
      ap.activity_id::text || '_' || ap.user_id::text as ref_id,
      ap.activity_id as activity_id,
      ap.user_id as volunteer_id,
      ap.status::text as status,
      case when ap.status::text in ('CANCELLED', 'REJECTED') then null else ap.email end as email,
      case when ap.status::text in ('CANCELLED', 'REJECTED') then null else ap.phone end as phone,
      ap.message as message,
      ap.created_at as shared_at
    from me
    join public.activities ac on ac.npo_id = me.id
    join public.activity_participants ap on ap.activity_id = ac.id
    where ap.status::text <> 'CANCELLED'
    union all
    select
      'APPLICATION'::text,
      a.id::text,
      null::uuid,
      a.volunteer_id,
      a.status::text,
      case when a.status::text = 'REJECTED' then null else a.email end,
      case when a.status::text = 'REJECTED' then null else a.phone end,
      a.message,
      a.created_at
    from me
    join public.applications a on a.npo_id = me.id
  )
  select
    r.source,
    r.ref_id,
    r.activity_id,
    r.volunteer_id,
    case when public.profile_access_level(r.volunteer_id) in ('full', 'admin') then v.full_name end,
    case when public.profile_access_level(r.volunteer_id) in ('full', 'admin') then v.avatar_url end,
    r.status,
    r.email,
    r.phone,
    r.message,
    r.shared_at
  from rows_all r
  join public.profiles v on v.id = r.volunteer_id
  where (p_volunteer_id is null or r.volunteer_id = p_volunteer_id)
    and (p_activity_id is null or r.activity_id = p_activity_id)
  order by r.shared_at desc nulls last
  limit 1000;
$$;

revoke all on function public.get_shared_contacts_for_npo(uuid, uuid) from public, anon;
grant execute on function public.get_shared_contacts_for_npo(uuid, uuid) to authenticated;

-- 5. La email del profilo non e' piu' condivisa con gli enti (il vecchio ramo show_email + candidatura APPROVED esce):
--    la vede solo il proprietario e l'admin. La colonna show_email resta, inerte, fino alla pulizia P9.
create or replace function public.get_public_profiles(p_ids uuid[] default null::uuid[], p_role user_role default null::user_role, p_limit integer default 200, p_offset integer default 0)
 returns table(profile_id uuid, role user_role, access text, display_name text, avatar_url text, bio text, location_string text, location_lat double precision, location_lng double precision, impact_points integer, level integer, badges jsonb, skills text[], interests text[], show_volunteering_history boolean, last_seen_at timestamp with time zone, is_verified boolean, npo_name text, company_name text, website text, npo_website text, public_email text, email text, phone text, allow_calls boolean, referent_name text, referent_role text, referent_avatar_url text, sought_skills text[], created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
    case when a.access in ('self', 'admin') then a.email end,
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
$function$;

-- ROLLBACK (non eseguire insieme alla migrazione):
--   drop function if exists public.get_shared_contacts_for_npo(uuid, uuid);
--   drop policy if exists "Participants viewable by signed-in users" on public.activity_participants;
--   create policy "Participants viewable by everyone" on public.activity_participants for select to public using (true);
--   grant select on public.activity_participants to anon, authenticated;
--   grant select on public.applications to anon, authenticated;
--   alter table public.activity_participants drop column if exists email;
--   alter table public.applications drop column if exists email, drop column if exists phone;
--   -- get_public_profiles: ripristinare il ramo email di 20261025100000_a26_p3_public_profiles.sql
