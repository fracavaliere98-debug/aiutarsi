-- A22 (2026-10-25): policy doppie su public.profiles.
-- "Users can update their own profile" e "Users can insert their own profile" sono identiche
-- (ruolo authenticated, using/check id = auth.uid()) a "Profiles update own row" e
-- "Profiles insert own row", che restano. Nessun cambio di comportamento.
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
