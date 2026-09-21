-- Regola di prodotto: un'attività non si elimina mai fisicamente, si ANNULLA
-- (status = 'CANCELLATA') e resta nello storico con badge "Cancellata".
--
-- Problema: la policy "NPOs can manage own activities" era FOR ALL (nessun comando
-- specificato), quindi consentiva anche DELETE all'ente proprietario via API, aggirando
-- il flusso di annullamento (che notifica i volontari iscritti). Le FK a
-- activity_participants/reviews/volunteer_reviews/conversations avrebbero inoltre
-- propagato la cancellazione a iscrizioni, recensioni e XP già assegnati.
--
-- Fix: sostituire la policy FOR ALL con INSERT + UPDATE espliciti (stessa condizione di
-- prima) e NON creare alcuna policy DELETE: con RLS attiva, l'assenza di una policy nega
-- il DELETE a tutti i ruoli client. Restano possibili solo i percorsi con service role /
-- postgres (es. cascade da process-account-deletions quando un ente cancella il proprio
-- account), che non passano dalla RLS.
--
-- Rollback: DROP delle due nuove policy e ricreazione di
--   CREATE POLICY "NPOs can manage own activities" ON public.activities
--     USING (auth.uid() = npo_id);

DROP POLICY IF EXISTS "NPOs can manage own activities" ON public.activities;

CREATE POLICY "NPOs can insert own activities" ON public.activities
  FOR INSERT
  WITH CHECK (auth.uid() = npo_id);

CREATE POLICY "NPOs can update own activities" ON public.activities
  FOR UPDATE
  USING (auth.uid() = npo_id)
  WITH CHECK (auth.uid() = npo_id);
