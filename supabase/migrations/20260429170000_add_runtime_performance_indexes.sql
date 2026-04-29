-- Runtime performance indexes for hot paths used by preview/production clients.
-- Keep these non-canonical: they do not change domain semantics, only query plans.

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender_created_at
ON public.messages (conversation_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_visible
ON public.conversation_participants (user_id, hidden_at, inbox_visible_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conversation
ON public.conversation_participants (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created_at
ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_volunteer_created_at
ON public.applications (volunteer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_npo_created_at
ON public.applications (npo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_participants_user_status_created_at
ON public.activity_participants (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_participants_activity_status
ON public.activity_participants (activity_id, status);

CREATE INDEX IF NOT EXISTS idx_npo_followers_follower_npo
ON public.npo_followers (follower_id, npo_id);
