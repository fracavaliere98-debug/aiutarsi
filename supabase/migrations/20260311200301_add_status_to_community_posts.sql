-- Add moderation status column to community_posts
ALTER TABLE public.community_posts 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
CHECK (status IN ('published', 'pending', 'needs_review', 'shadow_banned', 'removed'));

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON public.community_posts(status);

-- Backfill existing posts as published
UPDATE public.community_posts SET status = 'published' WHERE status IS NULL OR status = '';
;
