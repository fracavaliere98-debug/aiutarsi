-- A26 P6b: privacy nelle chat.
-- Trovato leggendo le funzioni (e provato su staging con rollback):
--  1) get_chat_inbox(p_user_id) e' SECURITY DEFINER e si fidava del parametro: un utente qualunque
--     poteva leggere la inbox di un altro (titoli e ultimo messaggio). Ora vale solo per se stessi
--     (service_role escluso dal controllo, per le edge function).
--  2) La inbox mostrava nome intero e foto dell'altro anche per un volontario non pubblico.
--     Ora titolo e foto arrivano da get_public_profiles, cioe' come li vede chi guarda
--     ("Marta B." e nessuna foto finche' il volontario non agisce verso l'ente).
--  3) La regola di riga di profiles (can_view_profile_row) apriva il profilo a chiunque condividesse
--     una conversazione, anche quando l'ente aveva solo scritto per primo. Decisione A26:
--     lo sblocca la RISPOSTA del volontario (gia' prevista da profile_access_level), non la chat aperta.
--  4) get_unread_messages_count(p_user_id) restituiva i non letti di chiunque.

create or replace function public.can_view_profile_row(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.profile_access_level(p_target) in ('self', 'admin', 'full');
$function$;

create or replace function public.get_chat_inbox(p_user_id uuid)
returns table(
  conversation_id uuid,
  conversation_type text,
  activity_id uuid,
  created_at timestamp with time zone,
  last_message_content text,
  last_message_at timestamp with time zone,
  last_message_sender_id uuid,
  inbox_visible_at timestamp with time zone,
  last_read_at timestamp with time zone,
  title text,
  avatar_url text,
  other_user_id uuid,
  unread_count integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  WITH user_rows AS (
    SELECT
      cp.conversation_id,
      cp.last_read_at,
      cp.inbox_visible_at
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user_id
      AND cp.hidden_at IS NULL
      AND (p_user_id = auth.uid() OR coalesce(auth.role(), '') = 'service_role')
  )
  SELECT
    ur.conversation_id,
    c.type::text AS conversation_type,
    c.activity_id,
    c.created_at,
    c.last_message_content,
    c.last_message_at,
    c.last_message_sender_id,
    ur.inbox_visible_at,
    ur.last_read_at,
    CASE
      WHEN c.type = 'PRIVATE' THEN COALESCE(other_profile.npo_name, other_profile.display_name, 'Chat Diretta')
      ELSE COALESCE(a.title, 'Gruppo Attività')
    END AS title,
    CASE
      WHEN c.type = 'PRIVATE' THEN other_profile.avatar_url
      ELSE NULL
    END AS avatar_url,
    CASE
      WHEN c.type = 'PRIVATE' THEN other_part.user_id
      ELSE NULL
    END AS other_user_id,
    COALESCE(unread.unread_count, 0)::integer AS unread_count
  FROM user_rows ur
  JOIN public.conversations c
    ON c.id = ur.conversation_id
  LEFT JOIN public.activities a
    ON a.id = c.activity_id
  LEFT JOIN LATERAL (
    SELECT cp2.user_id
    FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = ur.conversation_id
      AND cp2.user_id <> p_user_id
    ORDER BY cp2.user_id
    LIMIT 1
  ) other_part ON c.type = 'PRIVATE'
  LEFT JOIN LATERAL (
    SELECT g.display_name, g.npo_name, g.avatar_url
    FROM public.get_public_profiles(p_ids => ARRAY[other_part.user_id], p_limit => 1) g
    LIMIT 1
  ) other_profile ON other_part.user_id IS NOT NULL
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM public.messages m
    WHERE m.conversation_id = ur.conversation_id
      AND m.sender_id <> p_user_id
      AND (ur.last_read_at IS NULL OR m.created_at > ur.last_read_at)
  ) unread ON TRUE
  WHERE (
    (c.last_message_at IS NOT NULL AND COALESCE(BTRIM(c.last_message_content), '') <> '')
    OR (c.type = 'PRIVATE' AND ur.inbox_visible_at IS NOT NULL)
  )
    AND (
      c.type <> 'PRIVATE'
      OR other_part.user_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.blocked_users bu
        WHERE (bu.blocker_id = p_user_id AND bu.blocked_id = other_part.user_id)
           OR (bu.blocker_id = other_part.user_id AND bu.blocked_id = p_user_id)
      )
    )
  ORDER BY COALESCE(c.last_message_at, ur.inbox_visible_at, c.created_at) DESC;
$function$;

create or replace function public.get_unread_messages_count(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  unread_count bigint;
begin
  if p_user_id is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_allowed';
  end if;

  select coalesce(sum(
    (select count(*)
     from messages m
     where m.conversation_id = cp.conversation_id
       and m.created_at > coalesce(cp.last_read_at, '1970-01-01'::timestamp)
       and m.sender_id != p_user_id)
  ), 0) into unread_count
  from conversation_participants cp
  where cp.user_id = p_user_id;

  return unread_count;
end;
$function$;
