-- A26 P1 (25/10/2026): nessun utente puo' darsi il ruolo ADMIN da solo.
--
-- 1) handle_new_user leggeva il ruolo da raw_user_meta_data senza lista consentita: chi si
--    registra con data.role = 'ADMIN' otteneva un profilo ADMIN (provato su staging con
--    transazione annullata). Ora i metadati possono scegliere solo VOLUNTEER, NPO o CORPORATE;
--    qualsiasi altro valore (ADMIN compreso, o un valore non valido) diventa VOLUNTEER.
--    Gli admin si creano solo lato server: update public.profiles set role = 'ADMIN' con
--    service_role o postgres (il trigger protect_privileged_profile_fields lo consente solo a loro).
-- 2) La lettura admin dei documenti di verifica usava user_metadata del token, modificabile
--    dall'utente: ora usa public.is_current_user_admin(), che legge il ruolo vero in profiles.

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_referred_by_id uuid;
  v_role public.user_role;
begin
  begin
    v_referred_by_id := (new.raw_user_meta_data->>'referred_by_id')::uuid;
  exception when others then
    v_referred_by_id := null;
  end;

  v_role := case upper(coalesce(new.raw_user_meta_data->>'role', ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;

  insert into public.profiles (
    id,
    email,
    email_confirmed,
    full_name,
    avatar_url,
    role,
    npo_name,
    company_name,
    npo_vat_id,
    referred_by,
    referral_code
  )
  values (
    new.id,
    new.email,
    coalesce(new.email_confirmed_at is not null, false),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'displayName'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar'),
    v_role,
    coalesce(new.raw_user_meta_data->>'npo_name', new.raw_user_meta_data->>'npoName'),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName'),
    new.raw_user_meta_data->>'npo_vat_id',
    v_referred_by_id,
    substring(new.id::text, 1, 8)
  )
  on conflict (id) do update
  set email = excluded.email,
      email_confirmed = excluded.email_confirmed,
      updated_at = now();

  return new;
end;
$function$;

drop policy if exists "Admin Read Verification Docs" on storage.objects;
create policy "Admin Read Verification Docs"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'verification_docs' and public.is_current_user_admin());
