
-- Modifichiamo la policy su Profiles per nascondere i dati degli admin
-- Prima cancelliamo la vecchia policy "Public profiles are viewable by everyone."
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- Ora la ricreiamo ma con una restrizione: se il profilo interrogato appartiene a un ADMIN,
-- può essere visto solo da se stesso o da altri ADMIN. Altri utenti e anonimi non lo vedono.
CREATE POLICY "Public profiles are viewable by everyone except admins." 
ON public.profiles FOR SELECT
USING (
  role != 'ADMIN' OR
  id = auth.uid() OR
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
);

-- ==========================================
-- Esempio di RLS su Messages e Community Posts 
-- per bloccare le operazioni a chi è "BANNED"
-- ==========================================
-- Supabase onAuthStateChange & refreshSession ci darà i claim corretti
-- se configuratiamo l'Auth Hook per inietarli, ma fino ad allora possiamo 
-- già scrivere la policy considerando auth.jwt()

-- Per messaggi e post preferiamo usare le policy esistenti e fare un DROP e CREATE, 
-- oppure aggiungere una CHECK aggiuntiva dove possibile. 
-- In Supabase non si può aggiungere una condizione AND a una policy esistente con ALTER.
;
