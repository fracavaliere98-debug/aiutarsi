-- 56 SECURITY DEFINER functions in the public schema were callable by the
-- anon role via /rest/v1/rpc/<name> with no authentication token. This
-- includes write functions like send_chat_message, update_my_profile_core,
-- replace_my_skills, start_private_conversation_between, record_activity_share.
--
-- The app always authenticates before calling any RPC. No RPC in this project
-- is intentionally public. Revoking anon access has zero impact on normal
-- app usage and closes a significant unauthenticated attack surface.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
