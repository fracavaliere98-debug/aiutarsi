
-- Drop the SECURITY DEFINER view and recreate it as SECURITY INVOKER (default).
-- With SECURITY INVOKER, the view respects the RLS policies of the querying user,
-- so each user can only see their own unread counts — enforced by the RLS on
-- conversation_participants and messages.
DROP VIEW IF EXISTS public.unread_message_counts;

CREATE VIEW public.unread_message_counts
WITH (security_invoker = true)
AS
  SELECT
    cp.user_id,
    cp.conversation_id,
    count(m.id) AS unread_count
  FROM conversation_participants cp
  JOIN messages m ON cp.conversation_id = m.conversation_id
  WHERE m.created_at > cp.last_read_at
    AND m.sender_id <> cp.user_id
  GROUP BY cp.user_id, cp.conversation_id;

-- Grant SELECT to authenticated users (same as before)
GRANT SELECT ON public.unread_message_counts TO authenticated;
;
