-- D08: inviti degli enti alle attivita' (flag "gia' invitato" permanente, tetto di 5 inviti per
-- attivita') e volontari consigliati per una attivita' (solo dati minimi).
--
-- Perche' una tabella: le notifiche vengono cancellate dopo 20 giorni (cleanup_notification_retention),
-- quindi il flag e il tetto non potevano reggere. La tabella non e' scrivibile dal client.

-- 1) Tabella inviti (una riga per attivita' + volontario) ------------------------------------------
create table if not exists public.npo_activity_invites (
  activity_id  uuid not null references public.activities(id) on delete cascade,
  volunteer_id uuid not null references public.profiles(id)   on delete cascade,
  npo_id       uuid not null references public.profiles(id)   on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (activity_id, volunteer_id)
);

create index if not exists npo_activity_invites_npo_volunteer_idx
  on public.npo_activity_invites (npo_id, volunteer_id);

alter table public.npo_activity_invites enable row level security;

drop policy if exists "NPO reads own activity invites" on public.npo_activity_invites;
create policy "NPO reads own activity invites"
  on public.npo_activity_invites for select to authenticated
  using (npo_id = (select auth.uid()));

revoke all on public.npo_activity_invites from anon, authenticated;
grant select on public.npo_activity_invites to authenticated;

-- Recupera gli inviti mirati gia' mandati (le notifiche ancora presenti).
insert into public.npo_activity_invites (activity_id, volunteer_id, npo_id, created_at)
select distinct on (n.related_activity_id, n.user_id)
       n.related_activity_id, n.user_id, n.related_npo_id, n.created_at
  from public.notifications n
  join public.activities a on a.id = n.related_activity_id and a.npo_id = n.related_npo_id
  join public.profiles v on v.id = n.user_id and v.role::text = 'VOLUNTEER'
 where n.payload ->> 'invite' = 'ACTIVITY'
 order by n.related_activity_id, n.user_id, n.created_at
on conflict do nothing;

-- 2) send_npo_invite: invito mirato registrato, una sola volta, massimo 5 per attivita' ------------
create or replace function public.send_npo_invite(p_volunteer_id uuid, p_kind text, p_activity_id uuid default null)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_npo text;
  v_activity_title text;
  v_target_activity uuid := null;
  v_title text;
  v_msg text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role::text = 'NPO') then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_volunteer_id and p.role::text = 'VOLUNTEER') then
    raise exception 'INVALID_RECIPIENT';
  end if;
  if p_kind not in ('OPEN_ACTIVITIES', 'APPLY', 'ACTIVITY') then
    raise exception 'INVALID_KIND';
  end if;

  select coalesce(nullif(trim(p.npo_name), ''), nullif(trim(p.full_name), ''), 'Una NPO') into v_npo
    from public.profiles p where p.id = v_uid;

  if p_kind = 'ACTIVITY' then
    -- FOR UPDATE: serializza gli inviti della stessa attivita' (il tetto non si supera con due tap insieme).
    select a.title into v_activity_title
      from public.activities a
     where a.id = p_activity_id and a.npo_id = v_uid and a.status::text in ('APERTA', 'IN_CORSO')
       for update;
    if not found then
      raise exception 'INVALID_ACTIVITY';
    end if;
    v_target_activity := p_activity_id;
    v_title := 'Invito ad attività 🤝';
    v_msg := v_npo || ' ti invita a partecipare a "' || coalesce(v_activity_title, 'un''attività') || '"!';
  elsif p_kind = 'APPLY' then
    v_title := 'Invito a candidarti 🤝';
    v_msg := v_npo || ' ti invita a candidarti come volontario!';
  else
    v_title := 'Invito Attività 🤝';
    v_msg := v_npo || ' ti invita a partecipare alle proprie attività aperte!';
  end if;

  if exists (
    select 1 from public.blocked_users b
     where (b.blocker_id = p_volunteer_id and b.blocked_id = v_uid)
        or (b.blocker_id = v_uid and b.blocked_id = p_volunteer_id)
  ) then
    return false;
  end if;

  if p_kind = 'ACTIVITY' then
    -- Gia' invitato a questa attivita' (per sempre) oppure gia' iscritto: nessun nuovo invito.
    if exists (
      select 1 from public.npo_activity_invites i
       where i.activity_id = p_activity_id and i.volunteer_id = p_volunteer_id
    ) or exists (
      select 1 from public.activity_participants ap
       where ap.activity_id = p_activity_id and ap.user_id = p_volunteer_id
         and ap.status::text not in ('CANCELLED', 'REJECTED')
    ) then
      return false;
    end if;
    if (select count(*) from public.npo_activity_invites i where i.activity_id = p_activity_id) >= 5 then
      raise exception 'INVITE_LIMIT_REACHED';
    end if;
    insert into public.npo_activity_invites (activity_id, volunteer_id, npo_id)
    values (p_activity_id, p_volunteer_id, v_uid);
  elsif exists (
    select 1 from public.notifications n
     where n.user_id = p_volunteer_id
       and n.type = 'ACTIVITY_UPDATE'
       and n.related_npo_id = v_uid
       and n.related_activity_id is not distinct from v_target_activity
       and n.payload ->> 'invite' = p_kind
       and n.created_at > now() - interval '24 hours'
  ) then
    return false;
  end if;

  insert into public.notifications (user_id, type, title, message, related_activity_id, related_npo_id, read, payload)
  values (p_volunteer_id, 'ACTIVITY_UPDATE', v_title, v_msg, v_target_activity, v_uid, false,
          jsonb_build_object('invite', p_kind));
  return true;
end;
$function$;

revoke all on function public.send_npo_invite(uuid, text, uuid) from public, anon;
grant execute on function public.send_npo_invite(uuid, text, uuid) to authenticated;

-- 3) Volontari consigliati per una attivita' ---------------------------------------------------------
-- Solo l'ente proprietario di una attivita' aperta, e SOLO tra i suoi volontari: quelli con candidatura
-- all'ente APPROVATA (tab "Volontari" dell'ente). I follower non compaiono qui: si invitano dal flusso
-- "Salvataggio Last Minute". Ordine per compatibilita' (stesso vettore e soglia 0.7 di
-- get_matching_volunteers). Restituisce SOLO id, nome, foto e punteggio: niente posizione, contatti,
-- competenze. Esclusi bannati, bloccati, in cancellazione, gia' iscritti. Gli gia' invitati tornano con
-- already_invited = true cosi' l'ente vede lo stato e il contatore.
create or replace function public.get_suggested_volunteers_for_activity(p_activity_id uuid, p_limit integer default 10)
 returns table (volunteer_id uuid, full_name text, avatar_url text, score numeric, already_invited boolean)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (
    select 1 from public.activities a
     where a.id = p_activity_id and a.npo_id = v_uid and a.status::text in ('APERTA', 'IN_CORSO')
  ) then
    raise exception 'INVALID_ACTIVITY';
  end if;

  return query
  with act as (
    select a.embedding from public.activities a where a.id = p_activity_id
  ), scored as (
    select p.id, p.full_name, p.avatar_url,
           case when act.embedding is not null and p.embedding is not null
                then (1 - (p.embedding <=> act.embedding))::numeric end as sc,
           exists (select 1 from public.npo_activity_invites i
                    where i.activity_id = p_activity_id and i.volunteer_id = p.id) as invited
      from public.profiles p
      cross join act
     where p.role::text = 'VOLUNTEER'
       and coalesce(p.is_banned, false) = false
       and p.deletion_requested_at is null
       and public.profile_access_level(p.id) = 'full'
       and exists (
         select 1 from public.applications ap0
          where ap0.npo_id = v_uid and ap0.volunteer_id = p.id and ap0.status::text = 'APPROVED')
       and not exists (
         select 1 from public.blocked_users b
          where (b.blocker_id = p.id and b.blocked_id = v_uid)
             or (b.blocker_id = v_uid and b.blocked_id = p.id))
       and not exists (
         select 1 from public.activity_participants ap
          where ap.activity_id = p_activity_id and ap.user_id = p.id
            and ap.status::text not in ('CANCELLED', 'REJECTED'))
  ), picked as (
    (select s.id, s.full_name, s.avatar_url, s.sc, s.invited
       from scored s
      where s.invited = false and s.sc > 0.7
      order by s.sc desc
      limit v_limit)
    union all
    (select s.id, s.full_name, s.avatar_url, s.sc, s.invited
       from scored s
      where s.invited = true)
  )
  select pk.id, pk.full_name, pk.avatar_url, pk.sc, pk.invited
    from picked pk
   order by pk.invited asc, pk.sc desc nulls last;
end;
$function$;

revoke all on function public.get_suggested_volunteers_for_activity(uuid, integer) from public, anon;
grant execute on function public.get_suggested_volunteers_for_activity(uuid, integer) to authenticated;
