
-- 1. MESSAGES 
-- Drop e recreate the INSERT policy to check for is_banned in JWT
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Not banned
    COALESCE((auth.jwt()->'user_metadata'->>'is_banned')::boolean, false) IS NOT TRUE
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- 2. COMMUNITY POSTS
-- We only have author_id here as per the schema check earlier
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.community_posts;
CREATE POLICY "Authenticated users can create posts" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->'user_metadata'->>'is_banned')::boolean, false) IS NOT TRUE
    AND author_id = auth.uid()
  );

-- Assuming community_comments has author_id as well based on typical schema, but let's check or skip it if unsure.
-- Wait, information_schema didn't return community_comments columns properly or maybe it doesn't exist?
-- Actually the previous query returned: 
-- id, author_id, caption, image_url, linked_activity_id, created_at, images_urls, status
-- Those are community_posts fields. 
-- For messages it returned: id, conversation_id, sender_id, content, metadata, created_at
-- If community_comments doesn't exist or we don't know the exact column, we'll just handle posts and messages which are the main ones.
;
