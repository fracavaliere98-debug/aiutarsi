-- Estensione tabella profiles per onboarding NPO
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS npo_vat_id TEXT,
ADD COLUMN IF NOT EXISTS npo_website TEXT,
ADD COLUMN IF NOT EXISTS referent_name TEXT,
ADD COLUMN IF NOT EXISTS referent_role TEXT,
ADD COLUMN IF NOT EXISTS referent_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS auto_welcome_message TEXT,
ADD COLUMN IF NOT EXISTS address_full TEXT,
ADD COLUMN IF NOT EXISTS sought_skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS verification_doc_url TEXT,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Nota: Per il campo location (geography), assicuriamoci che l'estensione postgis sia abilitata
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Commenti per chiarezza
COMMENT ON COLUMN public.profiles.npo_vat_id IS 'Partita IVA o Codice Fiscale dellente';
COMMENT ON COLUMN public.profiles.sought_skills IS 'Skill ricercate frequentemente dallorganizzazione per i match';
COMMENT ON COLUMN public.profiles.is_verified IS 'Stato di verifica dellente (Bollino Blu)';
;
