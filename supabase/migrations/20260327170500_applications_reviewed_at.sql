alter table if exists public.applications
add column if not exists reviewed_at timestamptz;
