-- Fix RLS recursion introduced by policies that query public.profiles from public.profiles.
-- Use SECURITY DEFINER helpers so policy checks do not recurse through the same table.

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
  );
$$;
CREATE OR REPLACE FUNCTION public.is_current_user_banned()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT is_banned
    FROM public.profiles
    WHERE id = auth.uid()
  ), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_user_banned() TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());
DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
DROP POLICY IF EXISTS "Public profiles are viewable by everyone except admins." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone except admins."
  ON public.profiles
  FOR SELECT
  USING (
    role <> 'ADMIN'
    OR id = auth.uid()
    OR public.is_current_user_admin()
  );
DROP POLICY IF EXISTS "admin_read_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admin_read_audit_logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_current_user_banned() IS NOT TRUE
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.community_posts;
CREATE POLICY "Authenticated users can create posts"
  ON public.community_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_current_user_banned() IS NOT TRUE
  );
