-- Ensure authenticated users can read and manage their own profile relationals.
-- The mobile app updates these tables directly during profile save and then
-- rehydrates the current user via nested selects.

ALTER TABLE IF EXISTS public.user_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own skills" ON public.user_skills;
CREATE POLICY "Users can view their own skills"
  ON public.user_skills
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own skills" ON public.user_skills;
CREATE POLICY "Users can insert their own skills"
  ON public.user_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own skills" ON public.user_skills;
CREATE POLICY "Users can delete their own skills"
  ON public.user_skills
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE IF EXISTS public.user_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own interests" ON public.user_interests;
CREATE POLICY "Users can view their own interests"
  ON public.user_interests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own interests" ON public.user_interests;
CREATE POLICY "Users can insert their own interests"
  ON public.user_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own interests" ON public.user_interests;
CREATE POLICY "Users can delete their own interests"
  ON public.user_interests
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
