-- La select del client (hooks/notifications/constants.ts) richiede da sempre una
-- colonna "payload" mai creata da nessuna migrazione: la query di lista falliva
-- con 400 (colonna inesistente) mentre la count separata (solo "id") funzionava,
-- mostrando badge non-zero ma lista vuota per qualsiasi utente.
alter table if exists public.notifications
  add column if not exists payload jsonb not null default '{}'::jsonb;
