-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification_docs', 'verification_docs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read (needed for getPublicUrl to work)
-- First drop if exists to avoid errors on retry
DROP POLICY IF EXISTS "Public Read Verification Docs" ON storage.objects;
CREATE POLICY "Public Read Verification Docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'verification_docs');

-- 3. Allow authenticated users to upload their own documents
DROP POLICY IF EXISTS "Auth Upload Verification Docs" ON storage.objects;
CREATE POLICY "Auth Upload Verification Docs"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'verification_docs' 
    AND auth.role() = 'authenticated'
    AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. Allow users to update/delete their own documents
DROP POLICY IF EXISTS "Owner Update Verification Docs" ON storage.objects;
CREATE POLICY "Owner Update Verification Docs"
ON storage.objects FOR UPDATE
WITH CHECK (
    bucket_id = 'verification_docs' 
    AND auth.role() = 'authenticated'
    AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owner Delete Verification Docs" ON storage.objects;
CREATE POLICY "Owner Delete Verification Docs"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'verification_docs' 
    AND auth.role() = 'authenticated'
    AND (auth.uid())::text = (storage.foldername(name))[1]
);;
