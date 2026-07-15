-- Security hardening, 2026-07-15 (follow-up): fix `function_search_path_mutable`
-- advisor warnings on the 33 SECURITY DEFINER / trigger functions that had no
-- explicit search_path set.
--
-- A mutable search_path on a SECURITY DEFINER function is a real (if lower
-- severity than the RLS/grant issues fixed earlier today) hardening gap: if
-- an attacker could create objects in a schema that resolves earlier than
-- `public` for the calling session, they could shadow a table/function the
-- definer-owned function relies on and hijack its behavior. Pinning
-- search_path to `public, pg_temp` closes that off without changing any
-- function's behavior (all of these already reference unqualified
-- public-schema objects, which still resolve correctly with this search_path).
--
-- This is metadata-only (ALTER FUNCTION ... SET search_path), it does not
-- redefine any function body. Idempotent — safe to re-run.

ALTER FUNCTION public.auto_sync_chat_on_participation() SET search_path = public, pg_temp;
ALTER FUNCTION public.award_activity_completion_to_user(p_user_id uuid, p_activity_record record) SET search_path = public, pg_temp;
ALTER FUNCTION public.award_activity_completion_to_user(p_user_id uuid, p_activity_record activities) SET search_path = public, pg_temp;
ALTER FUNCTION public.award_gamification_xp(p_user_id uuid, p_xp_amount integer, p_badge jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_level_from_xp(p_xp integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_next_occurrence() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_activities_with_match(p_user_id uuid, p_category text, p_search text, p_center_lat double precision, p_center_lng double precision, p_radius_km double precision, p_limit integer, p_offset integer, p_skills text[], p_only_urgent boolean, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_statuses text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_matching_volunteers(p_activity_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_report_count(p_reported_id uuid, p_days integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_unread_messages_count(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_activity_completion_gamification() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_checkin_gamification() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_participation_status_gamification() SET search_path = public, pg_temp;
ALTER FUNCTION public.match_activities(query_embedding vector, match_threshold double precision, match_count integer, user_lat double precision, user_lng double precision) SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_activity_category(input text) SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_skill_value(input text) SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_admin_on_report() SET search_path = public, pg_temp;
ALTER FUNCTION public.on_activity_skill_change_for_embedding() SET search_path = public, pg_temp;
ALTER FUNCTION public.on_interest_change_for_embedding() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_audit_log_modification() SET search_path = public, pg_temp;
ALTER FUNCTION public.record_activity_share(p_activity_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_ai_call_rate_limits_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_notification_jobs_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_notification_rate_limits_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_runtime_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_story_metrics_daily_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_group_conversation_participants(p_conversation_id uuid, p_activity_id uuid, p_initiator_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_application_gamification() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_follow_gamification() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_review_gamification() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_activity_statuses() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_expired_activities() SET search_path = public, pg_temp;
