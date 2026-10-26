-- R05 (2026-10-26): il trigger che crea il profilo all'iscrizione esisteva solo su staging (aggiunto a mano,
-- nessuna migration lo creava) e mancava su prod. Su prod il profilo nasceva solo da ensure_my_profile
-- (client), perdendo dati dell'iscrizione come npo_vat_id. Ora e' scritto qui e uguale nei due ambienti.
-- handle_new_user: ruolo filtrato (solo NPO/CORPORATE, il resto VOLUNTEER), codice amico dal server,
-- nessun invitante dai metadata (A32), eccezione per i campi protetti (A22).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
