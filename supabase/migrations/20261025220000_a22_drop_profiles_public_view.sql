-- A22 (2026-10-25): elimina la vista public.profiles_public, creata solo su staging.
-- Era un doppione delle protezioni A26 gia' attive su staging e prod:
--   grant SELECT per colonna su public.profiles (niente email, telefono, indirizzo, data di nascita,
--   push token, coordinate, ban) + policy di riga can_view_profile_row (stessa regola di get_public_profiles).
-- Verificato prima di eliminarla: nessuna dipendenza nel DB, nessun riferimento nel repo,
-- zero chiamate API nelle 24h precedenti. Su prod la vista non esiste: questo file li' non fa nulla.
-- Fonte unica per i profili altrui: rpc get_public_profiles (vedi services/AuthService.ts).
drop view if exists public.profiles_public;
