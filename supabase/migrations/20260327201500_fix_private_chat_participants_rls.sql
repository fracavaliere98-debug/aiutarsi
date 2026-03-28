ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can read participants of their conversations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.conversation_participants self_cp
    WHERE self_cp.conversation_id = conversation_participants.conversation_id
      AND self_cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can join their own conversations" ON public.conversation_participants;
CREATE POLICY "Users can join their own conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.conversation_participants self_cp
    JOIN public.conversations c ON c.id = self_cp.conversation_id
    WHERE self_cp.conversation_id = conversation_participants.conversation_id
      AND self_cp.user_id = auth.uid()
      AND c.type = 'PRIVATE'
  )
);
