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
BEGIN
  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  JOIN public.conversation_participants cp1
    ON cp1.conversation_id = c.id
   AND cp1.user_id = p_user_id_1
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = c.id
   AND cp2.user_id = p_user_id_2
  WHERE c.type = 'PRIVATE'
    AND c.activity_id IS NULL
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET
      last_message_content = COALESCE(NULLIF(BTRIM(last_message_content), ''), 'Nuova conversazione'),
      last_message_at = COALESCE(last_message_at, now()),
      last_message_sender_id = COALESCE(last_message_sender_id, p_user_id_1)
    WHERE id = v_conversation_id;

    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations(
    type,
    last_message_content,
    last_message_at,
    last_message_sender_id
  )
  VALUES (
    'PRIVATE',
    'Nuova conversazione',
    now(),
    p_user_id_1
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants(conversation_id, user_id)
  VALUES
    (v_conversation_id, p_user_id_1),
    (v_conversation_id, p_user_id_2)
  ON CONFLICT DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_private_conversation_between(uuid, uuid) TO authenticated;
