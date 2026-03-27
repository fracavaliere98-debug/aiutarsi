-- Drop and recreate the trigger function with SECURITY DEFINER to ensure it can write to conversations
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET 
        last_message_content = NEW.content,
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_id
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$;

-- Ensure trigger is correctly attached (drop and re-create to be safe)
DROP TRIGGER IF EXISTS tr_update_conversation_last_message ON public.messages;

CREATE TRIGGER tr_update_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Immediate backfill: sync all stale conversations
UPDATE public.conversations c
SET 
    last_message_content = latest.content,
    last_message_at = latest.created_at,
    last_message_sender_id = latest.sender_id
FROM (
    SELECT DISTINCT ON (conversation_id) 
        conversation_id, content, created_at, sender_id
    FROM public.messages
    ORDER BY conversation_id, created_at DESC
) latest
WHERE c.id = latest.conversation_id
  AND (c.last_message_at IS NULL OR c.last_message_at < latest.created_at);
;
