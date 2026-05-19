-- levels is a read-only lookup table (id, min_xp, name).
-- Enable RLS and allow any authenticated user to read, nobody to write.

alter table public.levels enable row level security;

create policy "Levels readable by authenticated users"
on public.levels
for select
to authenticated
using (true);
