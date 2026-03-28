ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_chat_inbox(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  conversation_type text,
  activity_id uuid,
  created_at timestamptz,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  inbox_visible_at timestamptz,
  last_read_at timestamptz,
  title text,
  avatar_url text,
  other_user_id uuid,
  unread_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_rows AS (
    SELECT
      cp.conversation_id,
      cp.last_read_at,
      cp.inbox_visible_at
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user_id
      AND cp.hidden_at IS NULL
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
      WHEN c.type = 'PRIVATE' THEN COALESCE(other_profile.npo_name, other_profile.full_name, 'Chat Diretta')
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
  LEFT JOIN public.profiles other_profile
    ON other_profile.id = other_part.user_id
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
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_inbox(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_private_conversation_between(
  p_user_id_1 uuid,
  p_user_id_2 uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE c.type = 'PRIVATE'
    AND c.activity_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id
        AND cp.user_id IN (p_user_id_1, p_user_id_2)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id
        AND cp.user_id NOT IN (p_user_id_1, p_user_id_2)
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations(type)
    VALUES ('PRIVATE')
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.conversation_participants(conversation_id, user_id, inbox_visible_at, hidden_at)
  VALUES
    (v_conversation_id, p_user_id_1, v_now, NULL),
    (v_conversation_id, p_user_id_2, v_now, NULL)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    inbox_visible_at = EXCLUDED.inbox_visible_at,
    hidden_at = NULL;

  UPDATE public.conversations c
  SET
    last_message_content = NULL,
    last_message_at = NULL,
    last_message_sender_id = NULL
  WHERE c.id = v_conversation_id
    AND c.type = 'PRIVATE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = c.id
    )
    AND COALESCE(BTRIM(c.last_message_content), '') = 'Nuova conversazione';

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_private_conversation_between(uuid, uuid) TO authenticated;
