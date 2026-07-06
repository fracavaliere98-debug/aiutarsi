-- pg_net logs every async HTTP response (from cron-driven net.http_post calls, e.g.
-- notification dispatch and AI webhooks) into an unlogged internal table that is never
-- read back by application code (verified: all call sites use `perform net.http_post(...)`
-- fire-and-forget, nothing selects from net._http_response). Rows are eventually deleted
-- by pg_net's own retention logic, but the resulting dead tuples are not reliably
-- reclaimed by autovacuum on this table, so physical size grows unbounded over time.
--
-- Observed impact: net._http_response reached 3.7GB on staging and 200MB+ on prod from
-- otherwise near-empty databases, pushing staging well past the Supabase free-plan 500MB
-- database size quota. Table was manually truncated to recover space; this migration
-- schedules an hourly prune of stale rows plus a daily plain VACUUM so it cannot
-- reaccumulate.

select cron.schedule(
  'cleanup-pg-net-http-response-hourly',
  '5 * * * *',
  $$ delete from net._http_response where created < now() - interval '1 hour'; $$
);

select cron.schedule(
  'vacuum-pg-net-http-response-daily',
  '30 4 * * *',
  $$ vacuum net._http_response; $$
);
