ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS inbox_visible_at timestamptz;

DROP POLICY IF EXISTS "Users can update their own conversation state" ON public.conversation_participants;
CREATE POLICY "Users can update their own conversation state"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

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

  INSERT INTO public.conversation_participants(conversation_id, user_id, inbox_visible_at)
  VALUES
    (v_conversation_id, p_user_id_1, v_now),
    (v_conversation_id, p_user_id_2, v_now)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET inbox_visible_at = EXCLUDED.inbox_visible_at;

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

UPDATE public.conversation_participants cp
SET inbox_visible_at = COALESCE(cp.inbox_visible_at, c.created_at, now())
FROM public.conversations c
WHERE c.id = cp.conversation_id
  AND c.type = 'PRIVATE'
  AND (
    cp.inbox_visible_at IS NULL
    OR (
      COALESCE(BTRIM(c.last_message_content), '') = 'Nuova conversazione'
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.conversation_id = c.id
      )
    )
  );

UPDATE public.conversations c
SET
  last_message_content = NULL,
  last_message_at = NULL,
  last_message_sender_id = NULL
WHERE c.type = 'PRIVATE'
  AND COALESCE(BTRIM(c.last_message_content), '') = 'Nuova conversazione'
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.conversation_id = c.id
  );
