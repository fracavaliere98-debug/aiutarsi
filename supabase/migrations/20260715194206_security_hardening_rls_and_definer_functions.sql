-- Security hardening pass, 2026-07-15.
--
-- Part 1 formalizes fixes that were already applied live to staging/prod via
-- direct SQL during an incident review (they existed only in the running
-- database, not in migration history — this migration makes them
-- reproducible on any fresh environment). Part 2 fixes newly discovered
-- authorization gaps in SECURITY DEFINER functions found during a targeted
-- review of the ~76 functions callable by `authenticated`.
--
-- All statements are idempotent (safe to re-run).

-- ---------------------------------------------------------------------------
-- Part 1: RLS / grants already live, now tracked
-- ---------------------------------------------------------------------------

-- 1a. `reports_insert_auth` had regressed (same day it was created) from
-- `TO authenticated WITH CHECK (auth.uid() = reporter_id)` to a bare
-- `WITH CHECK (true)` open to anyone, including unauthenticated requests.
-- Restore the original, correct policy.
DROP POLICY IF EXISTS "reports_insert_auth" ON public.reports;
CREATE POLICY "reports_insert_auth" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- 1b. `notifications` INSERT policy was open to `public` (including anon).
-- The app legitimately creates notifications for OTHER users (e.g. a
-- volunteer applying notifies the NPO), so we cannot check
-- `auth.uid() = user_id` here — we only remove the unauthenticated hole.
DROP POLICY IF EXISTS "System/Trigger insert" ON public.notifications;
CREATE POLICY "System/Trigger insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 1c. Rate-limit RPCs are only ever called server-side (edge functions using
-- the service role client). No client code calls them directly.
REVOKE EXECUTE ON FUNCTION public.try_consume_ai_rate_limit(text, integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_consume_notification_rate_limit(text, text, integer, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;

-- 1d. Public buckets don't need a broad SELECT policy for object access
-- (public URL access bypasses RLS entirely for public buckets); the only
-- effect of these policies was to let anyone list all files in the bucket.
-- No client code calls `.list()` on any of these buckets.
DROP POLICY IF EXISTS "Activities Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Public Read" ON storage.objects;
DROP POLICY IF EXISTS "community_media_public_select" ON storage.objects;
DROP POLICY IF EXISTS "community_media_authenticated_select" ON storage.objects;

-- ---------------------------------------------------------------------------
-- Part 2: newly found authorization gaps in SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

-- 2a. `award_gamification_xp` and `award_activity_completion_to_user` had no
-- caller check at all: any authenticated user could call them directly via
-- /rest/v1/rpc/<name> with an arbitrary p_user_id (including someone else's)
-- and an arbitrary XP amount / fabricated activity record, self-awarding
-- unlimited XP, levels and badges. They are only meant to be invoked
-- internally (PERFORM ...) from other SECURITY DEFINER trigger functions
-- owned by postgres, which still works fine after this revoke.
REVOKE EXECUTE ON FUNCTION public.award_gamification_xp(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_activity_completion_to_user(uuid, record) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_activity_completion_to_user(uuid, public.activities) FROM PUBLIC, anon, authenticated;

-- 2b. `get_report_count` is not called anywhere in the current app — it
-- exposes another user's confirmed-report count to any authenticated caller
-- who supplies their id. Lock it down until a legitimate, properly scoped
-- caller needs it.
REVOKE EXECUTE ON FUNCTION public.get_report_count(uuid, integer) FROM PUBLIC, anon, authenticated;

-- 2c. `start_private_conversation_between` let any authenticated user force
-- two arbitrary OTHER users into a private conversation. The only
-- legitimate caller (`ChatService.startPrivateConversation`) always passes
-- the current user as one of the two ids — enforce that server-side too.
CREATE OR REPLACE FUNCTION public.start_private_conversation_between(p_user_id_1 uuid, p_user_id_2 uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conversation_id uuid;
  v_now timestamptz := now();
  v_private_key text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() NOT IN (p_user_id_1, p_user_id_2) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  v_private_key := (
    SELECT string_agg(user_id::text, ':' ORDER BY user_id::text)
    FROM (VALUES (p_user_id_1), (p_user_id_2)) AS users(user_id)
  );

  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE c.type = 'PRIVATE'
    AND c.activity_id IS NULL
    AND c.private_key = v_private_key
  ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations(type, private_key)
    VALUES ('PRIVATE', v_private_key)
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.conversation_participants(conversation_id, user_id, inbox_visible_at, hidden_at)
  VALUES
    (v_conversation_id, p_user_id_1, v_now, NULL),
    (v_conversation_id, p_user_id_2, v_now, NULL)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    inbox_visible_at = EXCLUDED.inbox_visible_at,
    hidden_at = NULL;

  UPDATE public.conversations c
  SET
    last_message_content = NULL,
    last_message_at = NULL,
    last_message_sender_id = NULL
  WHERE c.id = v_conversation_id
    AND c.type = 'PRIVATE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = c.id
    )
    AND COALESCE(BTRIM(c.last_message_content), '') IN ('', 'Nuova conversazione');

  RETURN v_conversation_id;
END;
$function$;

-- 2d. `get_matching_volunteers` let any authenticated user (not just the NPO
-- that owns the activity) pull a ranked list of matched volunteer user_ids
-- for any activity_id. Restrict to the owning NPO.
CREATE OR REPLACE FUNCTION public.get_matching_volunteers(p_activity_id uuid)
 RETURNS TABLE(user_id uuid, score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = p_activity_id AND a.npo_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.id as user_id,
    (1 - (p.embedding <=> a.embedding))::numeric as score
  FROM public.profiles p
  CROSS JOIN public.activities a
  WHERE a.id = p_activity_id
  AND p.role = 'VOLUNTEER'
  AND p.embedding IS NOT NULL
  AND (1 - (p.embedding <=> a.embedding)) > 0.7
  ORDER BY score DESC;
END;
$function$;

-- 2e. `update_my_profile_core` correctly scopes every write to
-- `where id = auth.uid()`, but it let the caller set `is_verified`,
-- `impact_points` and `verification_status` on their OWN row — letting any
-- user self-grant NPO verification and arbitrary gamification points,
-- bypassing the admin review flow and the `award_gamification_xp` ledger
-- entirely. Those three fields are removed from the payload-driven update;
-- everything else is unchanged.
CREATE OR REPLACE FUNCTION public.update_my_profile_core(p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  begin
    update public.profiles
    set
      full_name = case when p_payload ? 'full_name' then nullif(trim(p_payload->>'full_name'), '') else full_name end,
      avatar_url = case when p_payload ? 'avatar_url' then nullif(trim(p_payload->>'avatar_url'), '') else avatar_url end,
      bio = case when p_payload ? 'bio' then p_payload->>'bio' else bio end,
      npo_name = case when p_payload ? 'npo_name' then nullif(trim(p_payload->>'npo_name'), '') else npo_name end,
      company_name = case when p_payload ? 'company_name' then nullif(trim(p_payload->>'company_name'), '') else company_name end,
      phone = case when p_payload ? 'phone' then nullif(trim(p_payload->>'phone'), '') else phone end,
      website = case when p_payload ? 'website' then nullif(trim(p_payload->>'website'), '') else website end,
      location_string = case when p_payload ? 'location_string' then p_payload->>'location_string' else location_string end,
      location_lat = case when p_payload ? 'location_lat' then (p_payload->>'location_lat')::double precision else location_lat end,
      location_lng = case when p_payload ? 'location_lng' then (p_payload->>'location_lng')::double precision else location_lng end,
      public_email = case when p_payload ? 'public_email' then nullif(trim(p_payload->>'public_email'), '') else public_email end,
      profile_completed = case when p_payload ? 'profile_completed' then (p_payload->>'profile_completed')::boolean else profile_completed end,
      profile_public = case when p_payload ? 'profile_public' then (p_payload->>'profile_public')::boolean else profile_public end,
      show_email = case when p_payload ? 'show_email' then (p_payload->>'show_email')::boolean else show_email end,
      show_volunteering_history = case when p_payload ? 'show_volunteering_history' then (p_payload->>'show_volunteering_history')::boolean else show_volunteering_history end,
      volunteer_list_visible = case when p_payload ? 'volunteer_list_visible' then (p_payload->>'volunteer_list_visible')::boolean else volunteer_list_visible end,
      allow_calls = case when p_payload ? 'allow_calls' then (p_payload->>'allow_calls')::boolean else allow_calls end,
      expo_push_token = case when p_payload ? 'expo_push_token' then nullif(trim(p_payload->>'expo_push_token'), '') else expo_push_token end,
      deletion_requested_at = case when p_payload ? 'deletion_requested_at' then nullif(p_payload->>'deletion_requested_at', '')::timestamptz else deletion_requested_at end,
      npo_vat_id = case when p_payload ? 'npo_vat_id' then nullif(trim(p_payload->>'npo_vat_id'), '') else npo_vat_id end,
      npo_website = case when p_payload ? 'npo_website' then nullif(trim(p_payload->>'npo_website'), '') else npo_website end,
      referent_name = case when p_payload ? 'referent_name' then nullif(trim(p_payload->>'referent_name'), '') else referent_name end,
      referent_role = case when p_payload ? 'referent_role' then nullif(trim(p_payload->>'referent_role'), '') else referent_role end,
      referent_avatar_url = case when p_payload ? 'referent_avatar_url' then nullif(trim(p_payload->>'referent_avatar_url'), '') else referent_avatar_url end,
      auto_welcome_message = case when p_payload ? 'auto_welcome_message' then p_payload->>'auto_welcome_message' else auto_welcome_message end,
      address_full = case when p_payload ? 'address_full' then p_payload->>'address_full' else address_full end,
      sought_skills = case when p_payload ? 'sought_skills' then p_payload->'sought_skills' else sought_skills end,
      verification_doc_url = case when p_payload ? 'verification_doc_url' then nullif(trim(p_payload->>'verification_doc_url'), '') else verification_doc_url end,
      updated_at = now()
    where id = auth.uid();
  end;
  $function$;
