-- update_my_profile_core (hardening del 2026-07-15) confrontava, nello stesso CASE,
-- "p_payload->'sought_skills'" (jsonb) con "sought_skills" (text[], colonna reale):
-- Postgres non trova un tipo comune tra i due rami e fallisce con 42804 ("CASE types
-- text[] and jsonb cannot be matched") per QUALSIASI chiamata alla funzione, payload
-- a parte. Verificato in staging chiamando l'RPC autenticato. Fix: estrarre l'array
-- di stringhe dal jsonb invece di lasciarlo come jsonb.
create or replace function public.update_my_profile_core(p_payload jsonb DEFAULT '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
  begin
    update public.profiles
    set
      full_name = case when p_payload ? 'full_name' then nullif(trim(p_payload->>'full_name'), '') else full_name end,
      avatar_url = case when p_payload ? 'avatar_url' then nullif(trim(p_payload->>'avatar_url'), '') else avatar_url end,
      bio = case when p_payload ? 'bio' then p_payload->>'bio' else bio end,
      npo_name = case when p_payload ? 'npo_name' then nullif(trim(p_payload->>'npo_name'), '') else npo_name end,
      company_name = case when p_payload ? 'company_name' then nullif(trim(p_payload->>'company_name'), '') else company_name end,
      phone = case when p_payload ? 'phone' then nullif(trim(p_payload->>'phone'), '') else phone end,
      website = case when p_payload ? 'website' then nullif(trim(p_payload->>'website'), '') else website end,
      location_string = case when p_payload ? 'location_string' then p_payload->>'location_string' else location_string end,
      location_lat = case when p_payload ? 'location_lat' then (p_payload->>'location_lat')::double precision else location_lat end,
      location_lng = case when p_payload ? 'location_lng' then (p_payload->>'location_lng')::double precision else location_lng end,
      public_email = case when p_payload ? 'public_email' then nullif(trim(p_payload->>'public_email'), '') else public_email end,
      profile_completed = case when p_payload ? 'profile_completed' then (p_payload->>'profile_completed')::boolean else profile_completed end,
      profile_public = case when p_payload ? 'profile_public' then (p_payload->>'profile_public')::boolean else profile_public end,
      show_email = case when p_payload ? 'show_email' then (p_payload->>'show_email')::boolean else show_email end,
      show_volunteering_history = case when p_payload ? 'show_volunteering_history' then (p_payload->>'show_volunteering_history')::boolean else show_volunteering_history end,
      volunteer_list_visible = case when p_payload ? 'volunteer_list_visible' then (p_payload->>'volunteer_list_visible')::boolean else volunteer_list_visible end,
      allow_calls = case when p_payload ? 'allow_calls' then (p_payload->>'allow_calls')::boolean else allow_calls end,
      expo_push_token = case when p_payload ? 'expo_push_token' then nullif(trim(p_payload->>'expo_push_token'), '') else expo_push_token end,
      deletion_requested_at = case when p_payload ? 'deletion_requested_at' then nullif(p_payload->>'deletion_requested_at', '')::timestamptz else deletion_requested_at end,
      npo_vat_id = case when p_payload ? 'npo_vat_id' then nullif(trim(p_payload->>'npo_vat_id'), '') else npo_vat_id end,
      npo_website = case when p_payload ? 'npo_website' then nullif(trim(p_payload->>'npo_website'), '') else npo_website end,
      referent_name = case when p_payload ? 'referent_name' then nullif(trim(p_payload->>'referent_name'), '') else referent_name end,
      referent_role = case when p_payload ? 'referent_role' then nullif(trim(p_payload->>'referent_role'), '') else referent_role end,
      referent_avatar_url = case when p_payload ? 'referent_avatar_url' then nullif(trim(p_payload->>'referent_avatar_url'), '') else referent_avatar_url end,
      auto_welcome_message = case when p_payload ? 'auto_welcome_message' then p_payload->>'auto_welcome_message' else auto_welcome_message end,
      address_full = case when p_payload ? 'address_full' then p_payload->>'address_full' else address_full end,
      sought_skills = case when p_payload ? 'sought_skills' then (select array(select jsonb_array_elements_text(p_payload->'sought_skills'))) else sought_skills end,
      verification_doc_url = case when p_payload ? 'verification_doc_url' then nullif(trim(p_payload->>'verification_doc_url'), '') else verification_doc_url end,
      updated_at = now()
    where id = auth.uid();
  end;
  $function$;
