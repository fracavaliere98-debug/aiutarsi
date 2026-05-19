-- The previous migration revoked anon-specific grants, but the functions
-- were also reachable via the PUBLIC pseudo-role (granted by default in
-- Supabase). REVOKE FROM anon does not remove PUBLIC grants. This migration
-- closes that gap by revoking PUBLIC and re-granting only to authenticated.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Re-grant to authenticated: all app RPCs require a logged-in user.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- service_role needs execute on all functions for triggers and edge functions.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
