insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  type
)
values
  ('avatars', 'avatars', true, null, null, 'STANDARD'),
  ('activities', 'activities', true, null, null, 'STANDARD'),
  ('community_media', 'community_media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[], 'STANDARD'),
  ('verification_docs', 'verification_docs', true, null, null, 'STANDARD')
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  type = excluded.type,
  updated_at = now();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Activities Auth Upload'
  ) then
    execute $policy$
      create policy "Activities Auth Upload"
      on storage.objects
      for insert
      with check ((bucket_id = 'activities'::text) and (auth.role() = 'authenticated'::text));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Activities Public Read'
  ) then
    execute $policy$
      create policy "Activities Public Read"
      on storage.objects
      for select
      using (bucket_id = 'activities'::text);
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth Upload Verification Docs'
  ) then
    execute $policy$
      create policy "Auth Upload Verification Docs"
      on storage.objects
      for insert
      with check (
        (bucket_id = 'verification_docs'::text)
        and (auth.role() = 'authenticated'::text)
        and ((auth.uid())::text = (storage.foldername(name))[1])
      );
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Avatars Auth Upload'
  ) then
    execute $policy$
      create policy "Avatars Auth Upload"
      on storage.objects
      for insert
      with check ((bucket_id = 'avatars'::text) and (auth.role() = 'authenticated'::text));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Avatars Public Read'
  ) then
    execute $policy$
      create policy "Avatars Public Read"
      on storage.objects
      for select
      using (bucket_id = 'avatars'::text);
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Avatars User Delete'
  ) then
    execute $policy$
      create policy "Avatars User Delete"
      on storage.objects
      for delete
      using ((bucket_id = 'avatars'::text) and ((auth.uid())::text = (storage.foldername(name))[1]));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Avatars User Update'
  ) then
    execute $policy$
      create policy "Avatars User Update"
      on storage.objects
      for update
      with check ((bucket_id = 'avatars'::text) and ((auth.uid())::text = (storage.foldername(name))[1]));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owner Delete Verification Docs'
  ) then
    execute $policy$
      create policy "Owner Delete Verification Docs"
      on storage.objects
      for delete
      using (
        (bucket_id = 'verification_docs'::text)
        and (auth.role() = 'authenticated'::text)
        and ((auth.uid())::text = (storage.foldername(name))[1])
      );
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owner Update Verification Docs'
  ) then
    execute $policy$
      create policy "Owner Update Verification Docs"
      on storage.objects
      for update
      with check (
        (bucket_id = 'verification_docs'::text)
        and (auth.role() = 'authenticated'::text)
        and ((auth.uid())::text = (storage.foldername(name))[1])
      );
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Read Verification Docs'
  ) then
    execute $policy$
      create policy "Public Read Verification Docs"
      on storage.objects
      for select
      using (bucket_id = 'verification_docs'::text);
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Upload'
  ) then
    execute $policy$
      create policy "Public Upload"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = any (array['avatars'::text, 'activities'::text]));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public View'
  ) then
    execute $policy$
      create policy "Public View"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = any (array['avatars'::text, 'activities'::text]));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'community_media_auth_insert'
  ) then
    execute $policy$
      create policy "community_media_auth_insert"
      on storage.objects
      for insert
      to authenticated
      with check ((bucket_id = 'community_media'::text) and (auth.uid() is not null));
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'community_media_owner_delete'
  ) then
    execute $policy$
      create policy "community_media_owner_delete"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'community_media'::text);
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'community_media_public_select'
  ) then
    execute $policy$
      create policy "community_media_public_select"
      on storage.objects
      for select
      using (bucket_id = 'community_media'::text);
    $policy$;
  end if;
end
$$;
