-- ═══════════════════════════════════════════════════════════════════
-- FIX: Add DELETE handler to conversation preview trigger
-- When the last message is deleted, recalculate from the new last msg
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_last_content TEXT;
  v_new_last_at      TIMESTAMPTZ;
  v_new_last_sender  UUID;
  v_conv_id          UUID;
BEGIN
  -- Determine which conversation to update
  IF TG_OP = 'DELETE' THEN
    v_conv_id := OLD.conversation_id;
  ELSE
    v_conv_id := NEW.conversation_id;
  END IF;

  -- For INSERT: just use the new message
  IF TG_OP = 'INSERT' THEN
    UPDATE public.conversations
    SET
      last_message_content    = NEW.content,
      last_message_at         = NEW.created_at,
      last_message_sender_id  = NEW.sender_id
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  END IF;

  -- For DELETE: recalculate from the remaining messages
  IF TG_OP = 'DELETE' THEN
    SELECT content, created_at, sender_id
    INTO v_new_last_content, v_new_last_at, v_new_last_sender
    FROM public.messages
    WHERE conversation_id = OLD.conversation_id
    ORDER BY created_at DESC
    LIMIT 1;

    UPDATE public.conversations
    SET
      last_message_content    = v_new_last_content,   -- NULL if no messages left
      last_message_at         = v_new_last_at,
      last_message_sender_id  = v_new_last_sender
    WHERE id = OLD.conversation_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop old INSERT-only trigger and replace with INSERT+DELETE
DROP TRIGGER IF EXISTS tr_update_conversation_last_message ON public.messages;
CREATE TRIGGER tr_update_conversation_last_message
AFTER INSERT OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ═══════════════════════════════════════════════════════════════════
-- FIX: Recreate trg_auto_sync_chat_on_participation (was missing)
-- ═══════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════
-- FIX: Add missing profiles columns (last_seen_at, expo_push_token)
-- deletion_requested_at already exists (confirmed in earlier audit)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- CLEANUP: Remove duplicate INSERT policies on messages (keep only the
-- comprehensive ones added in our last migration)
-- ═══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
;
