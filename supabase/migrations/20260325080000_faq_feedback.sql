-- 20260325080000_faq_feedback.sql
-- FAQ Feedback table for Help Center analytics
CREATE TABLE IF NOT EXISTS public.faq_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    faq_id text NOT NULL,
    section_id text NOT NULL,
    faq_question text,
    vote text NOT NULL CHECK (vote IN ('up', 'down')),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);
-- RLS
ALTER TABLE public.faq_feedback ENABLE ROW LEVEL SECURITY;
-- Anyone authenticated can insert feedback
DROP POLICY IF EXISTS "Users can insert faq feedback" ON public.faq_feedback;
CREATE POLICY "Users can insert faq feedback"
    ON public.faq_feedback FOR INSERT
    TO authenticated
    WITH CHECK (true);
-- Only admins can read (based on profiles.role)
DROP POLICY IF EXISTS "Admins can read faq feedback" ON public.faq_feedback;
CREATE POLICY "Admins can read faq feedback"
    ON public.faq_feedback FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );
-- Index for fast aggregation
CREATE INDEX IF NOT EXISTS idx_faq_feedback_faq_id ON public.faq_feedback(faq_id);
CREATE INDEX IF NOT EXISTS idx_faq_feedback_vote ON public.faq_feedback(vote);
