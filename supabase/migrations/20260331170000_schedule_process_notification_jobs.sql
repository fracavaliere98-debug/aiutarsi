create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Legacy no-op migration kept for migration history consistency.
-- The original direct pg_cron -> Edge Function scheduling used a hardcoded
-- Supabase project URL and is intentionally no longer defined here so that
-- fresh production bootstraps do not inherit a staging URL.
--
-- Environment-safe scheduling is installed by:
--   20260401101500_make_notification_cron_environment_safe.sql
