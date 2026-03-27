-- Add missing DELETE policy for users to leave conversations
CREATE POLICY "Users can leave their own conversations" 
ON public.conversation_participants 
FOR DELETE TO authenticated 
USING (auth.uid() = user_id);

-- Optional: ensure when a new message is sent in a PRIVATE chat, 
-- missing participants are re-added (chat reappears)
-- But wait, without knowing who the other participant was, we can't easily re-add.
-- Actually, the simplest fix is just allowing the delete. 
;
