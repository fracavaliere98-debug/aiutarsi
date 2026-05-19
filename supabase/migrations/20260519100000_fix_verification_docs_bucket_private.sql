-- verification_docs bucket: was public=true with no-auth SELECT policy.
-- Documents of identity must never be readable without authentication and ownership check.

-- 1. Set bucket to private
update storage.buckets
set public = false
where id = 'verification_docs';

-- 2. Drop the open SELECT policy
drop policy if exists "Public Read Verification Docs" on storage.objects;

-- 3. Owner-only read: the uploader can read their own documents
create policy "Owner Read Verification Docs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification_docs'
  and (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. Admin read: users with role=ADMIN in their JWT can read any verification doc
create policy "Admin Read Verification Docs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification_docs'
  and (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);
