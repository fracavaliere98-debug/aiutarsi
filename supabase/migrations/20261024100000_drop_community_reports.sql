-- Rimozione della tabella legacy public.community_reports.
--
-- Contesto: le segnalazioni dei post community finiscono in public.reports (letta dagli admin);
-- nessun client e nessuna edge function scrive piu' in community_reports (docs/data-access-guidelines.md,
-- sezione "Segnalazioni"). Prima di questa migration la smoke function community-refactor-smoke e'
-- stata aggiornata (commit 2a59a4a) e riallineata su staging e prod.
--
-- Dati al momento della verifica: staging 2 righe (test di marzo 2026, status pending), prod 0 righe.
-- Il DROP TABLE elimina anche policy "Users can insert reports", trigger trg_notify_admin_on_report
-- e le FK verso community_posts / auth.users. Nessuna vista, funzione o tabella dipende dalla tabella.
-- La funzione trigger notify_admin_on_report() era usata solo da quel trigger: resterebbe orfana
-- (con GRANT ad anon/authenticated), quindi viene rimossa insieme.

SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS public.community_reports;
DROP FUNCTION IF EXISTS public.notify_admin_on_report();
