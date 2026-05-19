-- blocked_users had RLS policies defined but RLS itself was never enabled.
-- The policies were therefore completely ignored, allowing any authenticated
-- user to read, insert, or delete any row.

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
