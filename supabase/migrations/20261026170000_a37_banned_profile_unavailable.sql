-- A37 (2026-10-26). Decisioni di Francesco:
--  - chi apre il profilo di un utente bannato (ente, volontario, azienda) vede "Profilo non disponibile",
--    messaggio neutro: non si rivela a terzi la sanzione; l'admin vede tutto (+ banner nell'app);
--  - il bannato non compare nella ricerca/liste di scoperta; post e storie non sono visibili agli altri;
--  - "tutte le attivita' legate ad utenti bannati vengono annullate": al BAN si annullano le iscrizioni ad
--    attivita' non concluse e le candidature in attesa; se il bannato e' un ente, le sue attivita' non concluse
--    passano a CANCELLATA (annullo soft, D05; i partecipanti ricevono la notifica di annullamento).
--    La revoca del ban NON ripristina nulla.

-- 1) Helper per le policy.
create or replace function public.is_user_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select is_banned from public.profiles where id = p_user_id), false);
$$;
revoke all on function public.is_user_banned(uuid) from public, anon;
grant execute on function public.is_user_banned(uuid) to authenticated;

-- 2) Lettura diretta delle righe di profiles (policy can_view_profile_row): un bannato e' 'none' per tutti
--    tranne se stesso e l'admin. Resta l'eccezione gia' esistente delle conversazioni in comune (storico chat).
create or replace function public.profile_access_level(p_target uuid)
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with me as (
    select p.id, p.role, coalesce(p.is_verified, false) as verified from public.profiles p where p.id = auth.uid()
  ), t as (
    select p.id, p.role, p.volunteer_list_visible, coalesce(p.is_banned, false) as banned from public.profiles p where p.id = p_target
  )
  select case
    when not exists (select 1 from me) or not exists (select 1 from t) then 'none'
    when (select id from t) = (select id from me) then 'self'
    when (select role from me) = 'ADMIN' then 'admin'
    when (select banned from t) then 'none'
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
$function$;

-- 3) get_public_profiles: nuovo livello 'unavailable' per un bannato visto da chi non e' se stesso/admin.
--    Richiesta per id (pagina profilo) -> una riga con solo id, ruolo, access='unavailable' e nome
--    "Utente non disponibile", tutto il resto NULL. Elenco senza id (scoperta) -> il bannato non compare.
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
        when coalesce(c.is_banned, false) then 'unavailable'
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
  ),
  vis as (
    select * from acc a
    where a.access <> 'none'
      and not (a.access = 'unavailable' and p_ids is null)
  )
  select
    a.id,
    a.role,
    a.access,
    case when a.access = 'unavailable' then 'Utente non disponibile'
      when a.access <> 'limited' then a.full_name
      when position(' ' in trim(coalesce(a.full_name, ''))) > 0
        then split_part(trim(a.full_name), ' ', 1) || ' ' || upper(left(regexp_replace(trim(a.full_name), '^.*\s', ''), 1)) || '.'
      else coalesce(nullif(trim(a.full_name), ''), 'Volontario') end,
    case when a.access not in ('limited', 'unavailable') then a.avatar_url end,
    case when a.access not in ('limited', 'unavailable') then a.bio end,
    case when a.access not in ('limited', 'unavailable') and a.role in ('NPO', 'CORPORATE') then a.location_string end,
    case when a.access not in ('limited', 'unavailable') and a.role in ('NPO', 'CORPORATE') then a.location_lat end,
    case when a.access not in ('limited', 'unavailable') and a.role in ('NPO', 'CORPORATE') then a.location_lng end,
    case when a.access not in ('limited', 'unavailable') then a.impact_points end,
    case when a.access = 'unavailable' then null else coalesce((select g.level from public.gamification_state g where g.user_id = a.id), 1) end,
    case when a.access not in ('limited', 'unavailable') then a.badges end,
    case when a.access not in ('limited', 'unavailable') then array(select us.skill from public.user_skills us where us.user_id = a.id) else '{}'::text[] end,
    case when a.access not in ('limited', 'unavailable') then array(select ui.interest from public.user_interests ui where ui.user_id = a.id) else '{}'::text[] end,
    case when a.access not in ('limited', 'unavailable') then a.show_volunteering_history end,
    case when a.access not in ('limited', 'unavailable') then a.last_seen_at end,
    case when a.access = 'unavailable' then null else a.is_verified end,
    case when a.access <> 'unavailable' and a.role = 'NPO' then a.npo_name end,
    case when a.access <> 'unavailable' and a.role = 'CORPORATE' then a.company_name end,
    case when a.access <> 'unavailable' and a.role in ('NPO', 'CORPORATE') then a.website end,
    case when a.access <> 'unavailable' and a.role = 'NPO' then a.npo_website end,
    case when a.access <> 'unavailable' and a.role in ('NPO', 'CORPORATE') then a.public_email end,
    case when a.access in ('self', 'admin') then a.email end,
    case when a.access <> 'unavailable' and a.role in ('NPO', 'CORPORATE') then a.phone end,
    case when a.access <> 'unavailable' and a.role in ('NPO', 'CORPORATE') then a.allow_calls end,
    case when a.access <> 'unavailable' and a.role = 'NPO' then a.referent_name end,
    case when a.access <> 'unavailable' and a.role = 'NPO' then a.referent_role end,
    case when a.access <> 'unavailable' and a.role = 'NPO' then a.referent_avatar_url end,
    case when a.access <> 'unavailable' and a.role = 'NPO' then a.sought_skills end,
    case when a.access = 'unavailable' then null else a.created_at end
  from vis a
  order by a.full_name nulls last, a.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- 4) Post e storie di un bannato: non visibili agli altri (restano all'autore e all'admin; tornano con la revoca).
drop policy if exists "Banned authors hidden (posts)" on public.community_posts;
create policy "Banned authors hidden (posts)" on public.community_posts
  as restrictive for select to authenticated
  using (author_id = auth.uid() or public.is_current_user_admin() or not public.is_user_banned(author_id));
drop policy if exists "Banned authors hidden (stories)" on public.stories;
create policy "Banned authors hidden (stories)" on public.stories
  as restrictive for select to authenticated
  using (author_id = auth.uid() or public.is_current_user_admin() or not public.is_user_banned(author_id));

-- 5) Al BAN: annullamento di iscrizioni, candidature in attesa e (se ente) attivita' non concluse.
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_action text,
  p_reason text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.reports%rowtype;
  v_target_role public.user_role;
  v_rows int;
  v_participations int := 0;
  v_applications int := 0;
  v_activities int := 0;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_action not in ('dismissed', 'warned', 'banned') then
    raise exception 'invalid action: %', p_action using errcode = '22023';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if coalesce(v_report.status, 'pending') <> 'pending' then
    raise exception 'already_decided' using errcode = '22023', detail = v_report.status;
  end if;

  if p_action = 'banned' then
    if v_report.reported_id is null then
      raise exception 'report has no reported user' using errcode = '22023';
    end if;
    if v_report.reported_id = v_admin then
      raise exception 'cannot ban yourself' using errcode = '22023';
    end if;
    select role into v_target_role from public.profiles where id = v_report.reported_id;
    if v_target_role = 'ADMIN' then
      raise exception 'cannot ban an admin' using errcode = '22023';
    end if;

    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles
       set is_banned = true,
           ban_reason = nullif(trim(coalesce(p_reason, '')), ''),
           ban_report_id = v_report.id,
           updated_at = now()
     where id = v_report.reported_id;
    get diagnostics v_rows = row_count;
    perform set_config('app.bypass_profile_guard', 'false', true);
    if v_rows <> 1 then
      raise exception 'ban not applied (profile not found)' using errcode = 'P0002';
    end if;

    -- A37: iscrizioni del bannato ad attivita' non concluse
    update public.activity_participants ap
       set status = 'CANCELLED'
      from public.activities ac
     where ac.id = ap.activity_id
       and ap.user_id = v_report.reported_id
       and ap.status not in ('CANCELLED', 'REJECTED')
       and ac.status::text in ('APERTA', 'IN_CORSO');
    get diagnostics v_participations = row_count;

    -- A37: candidature in attesa (come volontario o, se ente, ricevute)
    update public.applications
       set status = 'REJECTED'
     where status = 'PENDING'
       and (volunteer_id = v_report.reported_id or npo_id = v_report.reported_id);
    get diagnostics v_applications = row_count;

    -- A37: se ente, le sue attivita' non concluse vengono annullate (soft, D05)
    if v_target_role = 'NPO' then
      update public.activities
         set status = 'CANCELLATA'
       where npo_id = v_report.reported_id
         and status::text in ('APERTA', 'IN_CORSO');
      get diagnostics v_activities = row_count;
    end if;
  end if;

  update public.reports
     set status = p_action,
         admin_id = v_admin,
         resolution_date = now()
   where id = v_report.id;

  insert into public.admin_audit_logs (admin_id, target_id, action_type, reason, user_agent)
  values (v_admin, v_report.reported_id, upper(p_action),
          coalesce(p_reason, '') || case when p_action = 'banned'
            then ' [annullate: iscrizioni ' || v_participations || ', candidature ' || v_applications || ', attivita'' ' || v_activities || ']'
            else '' end,
          left(p_user_agent, 200));

  return jsonb_build_object(
    'report_id', v_report.id,
    'action', p_action,
    'reported_id', v_report.reported_id,
    'reporter_id', v_report.reporter_id,
    'cancelled_participations', v_participations,
    'rejected_applications', v_applications,
    'cancelled_activities', v_activities
  );
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text, text, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, text, text, text) to authenticated;
