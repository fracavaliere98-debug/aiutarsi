-- ═══════════════════════════════════════════════════
-- FIX #2: Auto-sync trigger for activity participants
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_auto_chat_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'APPROVED' OR NEW.status = 'REGISTERED') THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT c.id, NEW.user_id 
    FROM public.conversations c
    WHERE c.activity_id = NEW.activity_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_sync_chat_on_participation ON public.activity_participants;
CREATE TRIGGER trg_auto_sync_chat_on_participation
AFTER INSERT OR UPDATE OF status ON public.activity_participants
FOR EACH ROW EXECUTE FUNCTION public.handle_auto_chat_sync();

-- ═══════════════════════════════════════════════════
-- FIX #3: Full RLS on messages table
-- ═══════════════════════════════════════════════════
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing to avoid conflicts
DROP POLICY IF EXISTS "Users can only read messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can only delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_no_send_if_blocked" ON public.messages;

-- SELECT: only conversation participants
CREATE POLICY "messages_select_participants"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
  )
);

-- INSERT base: must be a participant + sender_id matches auth user
CREATE POLICY "messages_insert_participants"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
  )
);

-- DELETE: only own messages
CREATE POLICY "messages_delete_own"
ON public.messages FOR DELETE
USING (sender_id = auth.uid());

-- ═══════════════════════════════════════════════════
-- FIX #4: blocked_users table
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);
-- Composite index used by the message send policy
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv_user 
  ON public.conversation_participants(conversation_id, user_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;

CREATE POLICY "blocked_users_select_own" 
  ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_insert_own" 
  ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete_own" 
  ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- Message send restriction: cannot send if any participant in the conv blocked you
CREATE POLICY "messages_no_send_if_blocked"
ON public.messages FOR INSERT
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.blocked_users bu
    JOIN public.conversation_participants cp
      ON cp.conversation_id = messages.conversation_id
     AND cp.user_id <> auth.uid()
    WHERE bu.blocker_id = cp.user_id
      AND bu.blocked_id = auth.uid()
  )
);
;
