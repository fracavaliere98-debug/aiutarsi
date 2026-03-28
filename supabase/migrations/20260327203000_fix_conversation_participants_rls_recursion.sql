CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_add_private_conversation_participant(
  p_conversation_id uuid,
  p_actor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.type = 'PRIVATE'
      AND public.is_conversation_participant(p_conversation_id, p_actor_id)
  );
$$;

DROP POLICY IF EXISTS "Users can read participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can read participants of their conversations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_conversation_participant(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can join their own conversations" ON public.conversation_participants;
CREATE POLICY "Users can join their own conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.can_add_private_conversation_participant(conversation_id, auth.uid())
);
