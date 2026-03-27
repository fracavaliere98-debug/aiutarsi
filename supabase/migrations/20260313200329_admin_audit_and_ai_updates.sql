-- 1. Tabella per Audit Logs Amministrativi
CREATE TABLE admin_audit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  target_id uuid, -- ID dell'utente o del contenuto oggetto dell'azione
  action_type text NOT NULL, -- 'BAN', 'UNBAN', 'WARN', 'HIDE_CONTENT', 'DISMISS_REPORT'
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Rendiamo la tabella Append-Only tramite trigger
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La tabella admin_audit_logs è a sola aggiunta (Append-Only) per motivi di conformità.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_update_audit_logs
BEFORE UPDATE ON admin_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER tr_prevent_delete_audit_logs
BEFORE DELETE ON admin_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_modification();

-- RLS per audit logs: Solo Admin possono leggere
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_logs" ON admin_audit_logs
  FOR SELECT USING (auth.jwt()->'user_metadata'->>'role' = 'ADMIN');

-- 2. Aggiornamento Tabella Reports per supportare flag AI
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_ai_generated boolean DEFAULT false;

-- Policy per permettere al server (service_role) di inserire report AI
-- In realtà l'insert anonimo/auth è già permesso, ma assicuriamoci
DROP POLICY IF EXISTS "reports_insert_auth" ON reports;
CREATE POLICY "reports_insert_auth" ON reports FOR INSERT WITH CHECK (true);
;
