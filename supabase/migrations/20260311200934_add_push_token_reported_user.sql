-- Add expo push token and last_seen_at to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Index for push token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token ON public.profiles(expo_push_token) WHERE expo_push_token IS NOT NULL;

-- Add reported_user_id to community_reports for user-level reporting from chat
ALTER TABLE public.community_reports
ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
;
