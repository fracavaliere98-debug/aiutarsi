-- A26 P6a: accesso alle chat.
-- Prima: qualunque utente loggato poteva inserire partecipanti in QUALSIASI conversazione
-- (policy "Authenticated users can insert participants") e iscriversi da solo a una chat
-- altrui conoscendone l'id. Le chat private si aprivano senza controllare relazione, blocchi o ban.
-- Ora: le chat private si aprono solo con la funzione start_private_conversation_between
-- (che controlla ban, blocchi e relazione); le chat di gruppo solo per l'ente proprietario
-- dell'attivita' e per chi e' iscritto/approvato all'attivita'.

-- 1) Policy troppo larghe su conversation_participants
drop policy if exists "Authenticated users can insert participants" on public.conversation_participants;
drop policy if exists "Users can join their own conversations" on public.conversation_participants;

create policy "Users can join their activity group chat"
  on public.conversation_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      join public.activities a on a.id = c.activity_id
      where c.id = conversation_participants.conversation_id
        and c.type::text = 'ACTIVITY_GROUP'
        and (
          a.npo_id = auth.uid()
          or exists (
            select 1 from public.activity_participants ap
            where ap.activity_id = a.id
              and ap.user_id = auth.uid()
              and ap.status::text in ('APPROVED', 'REGISTERED', 'CHECKED_IN')
          )
        )
    )
  );

-- 2) Creazione conversazioni: solo gruppi di attivita' dal client; le chat private passano dalla funzione
drop policy if exists "Authenticated users can insert conversations" on public.conversations;

create policy "Users can create activity group conversations"
  on public.conversations
  for insert
  to authenticated
  with check (
    type::text = 'ACTIVITY_GROUP'
    and activity_id is not null
    and exists (
      select 1 from public.activities a
      where a.id = conversations.activity_id
        and (
          a.npo_id = auth.uid()
          or exists (
            select 1 from public.activity_participants ap
            where ap.activity_id = a.id
              and ap.user_id = auth.uid()
              and ap.status::text in ('APPROVED', 'REGISTERED', 'CHECKED_IN')
          )
        )
    )
  );

-- La funzione di appoggio per le chat private non serve piu' alle policy
drop function if exists public.can_add_private_conversation_participant(uuid, uuid);

-- 3) Privilegi: niente accesso anonimo, niente privilegi non necessari
revoke all on table public.conversations from anon;
revoke all on table public.conversation_participants from anon;
revoke truncate, references, trigger on table public.conversations from authenticated;
revoke truncate, references, trigger on table public.conversation_participants from authenticated;

-- 4) Sincronizzazione partecipanti del gruppo: solo chi ha titolo, solo per la chat di quell'attivita'
create or replace function public.sync_group_conversation_participants(
  p_conversation_id uuid,
  p_activity_id uuid,
  p_initiator_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ids uuid[];
  v_caller uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if not v_is_service then
    if v_caller is null then
      raise exception 'not_allowed';
    end if;
    -- la chat deve essere il gruppo di QUELL'attivita'
    if not exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id
        and c.type::text = 'ACTIVITY_GROUP'
        and c.activity_id = p_activity_id
    ) then
      raise exception 'not_allowed';
    end if;
    -- chi chiama deve essere l'ente proprietario o un iscritto/approvato
    if not exists (
      select 1 from public.activities a
      where a.id = p_activity_id
        and (
          a.npo_id = v_caller
          or exists (
            select 1 from public.activity_participants ap
            where ap.activity_id = a.id
              and ap.user_id = v_caller
              and ap.status::text in ('APPROVED', 'REGISTERED', 'CHECKED_IN')
          )
        )
    ) then
      raise exception 'not_allowed';
    end if;
    -- l'iniziatore, se indicato, deve essere chi chiama
    if p_initiator_id is not null and p_initiator_id <> v_caller then
      raise exception 'not_allowed';
    end if;
  end if;

  select array_agg(ap.user_id) into v_ids
  from public.activity_participants ap
  where ap.activity_id = p_activity_id
    and ap.status::text in ('APPROVED', 'REGISTERED', 'CHECKED_IN');

  if p_initiator_id is not null then
    v_ids := array_append(coalesce(v_ids, '{}'::uuid[]), p_initiator_id);
  end if;

  if array_length(v_ids, 1) > 0 then
    insert into public.conversation_participants (conversation_id, user_id)
    select p_conversation_id, u.id
    from (select distinct unnest(v_ids) as id) u
    join public.profiles pr on pr.id = u.id
    where not coalesce(pr.is_banned, false)
    on conflict (conversation_id, user_id) do nothing;
  end if;
end;
$function$;

revoke execute on function public.sync_group_conversation_participants(uuid, uuid, uuid) from public, anon;
grant execute on function public.sync_group_conversation_participants(uuid, uuid, uuid) to authenticated, service_role;

-- 5) Apertura chat privata: ban, blocchi e relazione controllati dal server
create or replace function public.start_private_conversation_between(
  p_user_id_1 uuid,
  p_user_id_2 uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_my_role text;
  v_other_role text;
  v_conversation_id uuid;
  v_has_messages boolean := false;
  v_allowed boolean := false;
  v_now timestamptz := now();
  v_private_key text;
begin
  if v_me is null or v_me not in (p_user_id_1, p_user_id_2) then
    raise exception 'not_allowed';
  end if;

  v_other := case when v_me = p_user_id_1 then p_user_id_2 else p_user_id_1 end;
  if v_other is null or v_other = v_me then
    raise exception 'CHAT_NOT_ALLOWED';
  end if;

  select pr.role::text into v_my_role
  from public.profiles pr where pr.id = v_me and not coalesce(pr.is_banned, false);
  select pr.role::text into v_other_role
  from public.profiles pr where pr.id = v_other and not coalesce(pr.is_banned, false);

  -- profilo mancante o bannito (da una delle due parti)
  if v_my_role is null or v_other_role is null then
    raise exception 'CHAT_NOT_ALLOWED';
  end if;

  -- blocco in una qualunque direzione
  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = v_me and b.blocked_id = v_other)
       or (b.blocker_id = v_other and b.blocked_id = v_me)
  ) then
    raise exception 'CHAT_NOT_ALLOWED';
  end if;

  v_private_key := (
    select string_agg(u.user_id::text, ':' order by u.user_id::text)
    from (values (p_user_id_1), (p_user_id_2)) as u(user_id)
  );

  select c.id into v_conversation_id
  from public.conversations c
  where c.type::text = 'PRIVATE'
    and c.activity_id is null
    and c.private_key = v_private_key
  order by coalesce(c.last_message_at, c.created_at) desc, c.created_at desc
  limit 1;

  if v_conversation_id is not null then
    v_has_messages := exists (select 1 from public.messages m where m.conversation_id = v_conversation_id);
  end if;

  -- una conversazione gia' avviata con messaggi si puo' sempre riaprire (salvo ban/blocco)
  if v_has_messages then
    v_allowed := true;
  elsif v_my_role = 'ADMIN' or v_other_role = 'ADMIN' then
    v_allowed := true;
  elsif v_other_role in ('NPO', 'CORPORATE') then
    -- enti e aziende hanno un profilo pubblico: chiunque puo' scrivere loro
    v_allowed := true;
  elsif v_other_role = 'VOLUNTEER' and v_my_role = 'NPO' then
    -- un ente scrive a un volontario solo con una relazione reale
    v_allowed :=
      exists (select 1 from public.applications a where a.npo_id = v_me and a.volunteer_id = v_other)
      or exists (
        select 1 from public.activity_participants ap
        join public.activities ac on ac.id = ap.activity_id
        where ac.npo_id = v_me and ap.user_id = v_other
          and ap.status::text not in ('CANCELLED', 'REJECTED')
      )
      or exists (select 1 from public.npo_followers f where f.npo_id = v_me and f.follower_id = v_other);
  elsif v_other_role = 'VOLUNTEER' and v_my_role in ('VOLUNTEER', 'CORPORATE') then
    -- volontario con volontario solo se approvati dallo stesso ente
    v_allowed := exists (
      select 1 from public.applications a1
      join public.applications a2 on a2.npo_id = a1.npo_id
      where a1.volunteer_id = v_me and a2.volunteer_id = v_other
        and a1.status::text = 'APPROVED' and a2.status::text = 'APPROVED'
    );
  end if;

  if not v_allowed then
    raise exception 'CHAT_NOT_ALLOWED';
  end if;

  if v_conversation_id is null then
    insert into public.conversations(type, private_key)
    values ('PRIVATE', v_private_key)
    returning id into v_conversation_id;
  end if;

  insert into public.conversation_participants(conversation_id, user_id, inbox_visible_at, hidden_at)
  values
    (v_conversation_id, p_user_id_1, v_now, null),
    (v_conversation_id, p_user_id_2, v_now, null)
  on conflict (conversation_id, user_id)
  do update set
    inbox_visible_at = excluded.inbox_visible_at,
    hidden_at = null;

  update public.conversations c
  set
    last_message_content = null,
    last_message_at = null,
    last_message_sender_id = null
  where c.id = v_conversation_id
    and c.type::text = 'PRIVATE'
    and not exists (select 1 from public.messages m where m.conversation_id = c.id)
    and coalesce(btrim(c.last_message_content), '') in ('', 'Nuova conversazione');

  return v_conversation_id;
end;
$function$;

revoke execute on function public.start_private_conversation_between(uuid, uuid) from public, anon;
grant execute on function public.start_private_conversation_between(uuid, uuid) to authenticated, service_role;
