-- Fix permanente: loop infinito dei trigger di embedding (profiles/activities).
--
-- CAUSA (verificata su staging e prod, trigger identici):
--   trigger_update_profile_embedding e trigger_update_activity_embedding erano
--   AFTER INSERT OR UPDATE su QUALSIASI colonna. La edge function generate-embedding
--   scrive `UPDATE <tabella> SET embedding = ...` => rilancia lo stesso trigger =>
--   richiama la edge function => ... (loop auto-alimentato, ~120-160 chiamate/min,
--   quota Gemini free tier esaurita, backfill impossibile).
--   Effetti collaterali dello stesso difetto: ogni UPDATE di profiles.last_seen_at
--   (heartbeat client ogni 30 s per utente online) e ogni cambio di activities.status
--   (cron auto-update-activity-statuses ogni 15 min) generava una chiamata a Gemini.
--   I trigger tr_on_profile_bio_updated / tr_on_activity_inserted_or_desc_updated
--   chiamavano call_generate_embedding(), che legge un GUC (app.settings.service_role_key)
--   non configurato => di fatto codice morto (return new senza fare nulla).
--
-- SOLUZIONE:
--   * Un solo percorso: public.request_embedding_refresh(tabella, id), che invia alla
--     edge function SOLO i campi usati per costruire il testo (minimizzazione: niente
--     email/telefono/embedding nel payload).
--   * Trigger limitati alle colonne sorgente e con WHEN IS DISTINCT FROM:
--       profiles: INSERT, UPDATE OF bio
--       activities: INSERT, UPDATE OF title, category, description
--       user_skills / user_interests -> profiles; activity_skills -> activities
--     Scrivere `embedding`, `last_seen_at`, `status`, ecc. NON ri-esegue nulla:
--     il loop non e' strutturalmente piu' possibile.
--   * Constraint trigger DEFERRED + dedup per transazione: una transazione che tocca
--     N righe di competenze/interessi produce 1 sola chiamata (con lo stato finale).
--   * Niente piu' "embedding = NULL" come segnale: se la generazione fallisce resta il
--     vecchio vettore (piu' utile di nessun vettore per Smart Match).
--
-- NON TOCCA: public.call_generate_embedding() (resta, ora non referenziata da trigger;
--   e' citata dai test di lockdown scripts/test_prod_*).

-- 1. Rimozione trigger e funzioni vecchi ---------------------------------------
DROP TRIGGER IF EXISTS tr_on_profile_bio_updated ON public.profiles;
DROP TRIGGER IF EXISTS trigger_update_profile_embedding ON public.profiles;
DROP TRIGGER IF EXISTS tr_on_activity_inserted_or_desc_updated ON public.activities;
DROP TRIGGER IF EXISTS trigger_update_activity_embedding ON public.activities;
DROP TRIGGER IF EXISTS trigger_update_profile_embedding_on_interest ON public.user_interests;
DROP TRIGGER IF EXISTS trigger_update_profile_embedding_on_skill ON public.user_skills;
DROP TRIGGER IF EXISTS trigger_update_activity_embedding_on_skill ON public.activity_skills;

DROP FUNCTION IF EXISTS public.on_profile_change_for_embedding();
DROP FUNCTION IF EXISTS public.on_activity_change_for_embedding();
DROP FUNCTION IF EXISTS public.on_skill_change_for_embedding();
DROP FUNCTION IF EXISTS public.on_interest_change_for_embedding();
DROP FUNCTION IF EXISTS public.on_activity_skill_change_for_embedding();

-- 2. Helper unico -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_embedding_refresh(p_table text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_flag   text;
  v_record jsonb;
  v_secret text;
  v_url    text;
BEGIN
  IF p_id IS NULL OR p_table NOT IN ('profiles', 'activities') THEN
    RETURN;
  END IF;

  -- Dedup per transazione: la chiamata HTTP parte dopo il commit e la edge function
  -- rilegge competenze/interessi dal DB, quindi ne basta una per transazione.
  v_flag := 'app.emb_' || left(p_table, 1) || '_' || replace(p_id::text, '-', '_');
  IF coalesce(current_setting(v_flag, true), '') = '1' THEN
    RETURN;
  END IF;

  -- Stato corrente della riga (i trigger sono DEFERRED: qui e' lo stato finale).
  -- Solo i campi che la edge function usa per costruire il testo.
  IF p_table = 'profiles' THEN
    SELECT jsonb_build_object('id', p.id, 'bio', p.bio)
      INTO v_record
      FROM public.profiles p WHERE p.id = p_id;
  ELSE
    SELECT jsonb_build_object('id', a.id, 'title', a.title, 'category', a.category, 'description', a.description)
      INTO v_record
      FROM public.activities a WHERE a.id = p_id;
  END IF;

  IF v_record IS NULL THEN
    RETURN; -- riga cancellata (es. cascade da eliminazione account)
  END IF;

  SELECT value INTO v_secret FROM public.internal_secrets WHERE key = 'service_role_key';
  v_url := public.build_edge_function_url('generate-embedding');
  IF v_secret IS NULL OR v_url IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config(v_flag, '1', true);

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'table', p_table,
      'record', v_record,
      'type', 'TRIGGER'
    ),
    timeout_milliseconds := 5000
  );
END;
$fn$;

-- Funzione trigger generica: TG_ARGV[0] = tabella da rigenerare, TG_ARGV[1] = colonna con l'id
CREATE OR REPLACE FUNCTION public.trg_request_embedding_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  v_id := (CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END ->> TG_ARGV[1])::uuid;
  PERFORM public.request_embedding_refresh(TG_ARGV[0], v_id);
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.request_embedding_refresh(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_request_embedding_refresh() FROM PUBLIC, anon, authenticated;

-- 3. Trigger sulle sole colonne sorgente ----------------------------------------
CREATE CONSTRAINT TRIGGER trg_profiles_embedding_ins
  AFTER INSERT ON public.profiles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_request_embedding_refresh('profiles', 'id');

CREATE CONSTRAINT TRIGGER trg_profiles_embedding_upd
  AFTER UPDATE OF bio ON public.profiles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.bio IS DISTINCT FROM NEW.bio)
  EXECUTE FUNCTION public.trg_request_embedding_refresh('profiles', 'id');

CREATE CONSTRAINT TRIGGER trg_activities_embedding_ins
  AFTER INSERT ON public.activities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_request_embedding_refresh('activities', 'id');

CREATE CONSTRAINT TRIGGER trg_activities_embedding_upd
  AFTER UPDATE OF title, category, description ON public.activities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title
        OR OLD.category IS DISTINCT FROM NEW.category
        OR OLD.description IS DISTINCT FROM NEW.description)
  EXECUTE FUNCTION public.trg_request_embedding_refresh('activities', 'id');

CREATE CONSTRAINT TRIGGER trg_user_skills_embedding
  AFTER INSERT OR UPDATE OR DELETE ON public.user_skills
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_request_embedding_refresh('profiles', 'user_id');

CREATE CONSTRAINT TRIGGER trg_user_interests_embedding
  AFTER INSERT OR UPDATE OR DELETE ON public.user_interests
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_request_embedding_refresh('profiles', 'user_id');

CREATE CONSTRAINT TRIGGER trg_activity_skills_embedding
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_skills
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_request_embedding_refresh('activities', 'activity_id');
