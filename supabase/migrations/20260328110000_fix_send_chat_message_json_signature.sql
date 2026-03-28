DROP FUNCTION IF EXISTS public.send_chat_message(uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_content text,
  p_metadata json DEFAULT '{}'::json
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  metadata json,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.messages%ROWTYPE;
BEGIN
  IF p_sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blocked_users bu
    JOIN public.conversation_participants cp
      ON cp.conversation_id = p_conversation_id
     AND cp.user_id <> p_sender_id
    WHERE bu.blocker_id = cp.user_id
      AND bu.blocked_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  UPDATE public.conversation_participants
  SET
    hidden_at = NULL,
    inbox_visible_at = COALESCE(inbox_visible_at, now())
  WHERE conversation_id = p_conversation_id;

  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    metadata
  )
  VALUES (
    p_conversation_id,
    p_sender_id,
    p_content,
    COALESCE(p_metadata, '{}'::json)
  )
  RETURNING * INTO v_row;

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.conversation_id,
    v_row.sender_id,
    v_row.content,
    v_row.metadata,
    v_row.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, uuid, text, json) TO authenticated;
