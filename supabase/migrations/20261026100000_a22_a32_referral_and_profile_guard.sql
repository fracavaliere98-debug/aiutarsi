-- A22 + A32 (2026-10-26). Regola (Francesco, 26/10):
--  - referral_code = il codice PROPRIO da condividere: ogni utente ne ha uno, lo crea il server.
--  - referred_by   = "invitato da": si imposta SOLO se l'utente inserisce un codice valido in onboarding.
--                    Mai inventato, mai dedotto, una volta sola.
-- Prima: referred_by inserito in onboarding veniva scartato dal client (mai salvato), handle_new_user lo
-- accettava dai metadata di iscrizione (falsificabili), i codici erano misti minuscolo/maiuscolo con
-- ricerca sensibile alle maiuscole, 26 profili senza codice, e una collisione dei primi 8 caratteri
-- dell'id avrebbe fatto fallire l'iscrizione (vincolo UNIQUE).

-- 1) Generatore unico del codice proprio: 8 caratteri MAIUSCOLI dall'id, alternativa casuale se occupato.
create or replace function public.generate_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(substring(p_user_id::text, 1, 8));
  v_try int := 0;
begin
  while exists (select 1 from public.profiles where upper(referral_code) = v_code and id <> p_user_id) loop
    v_try := v_try + 1;
    if v_try > 20 then
      raise exception 'could not generate a unique referral code';
    end if;
    v_code := upper(substring(md5(p_user_id::text || clock_timestamp()::text || v_try::text), 1, 8));
  end loop;
  return v_code;
end;
$$;
revoke all on function public.generate_referral_code(uuid) from public, anon, authenticated;

-- 2) Iscrizione: referred_by non arriva piu' dai metadata (falsificabili); codice dal generatore.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  -- Il ruolo dai metadati e' ammesso solo per NPO e CORPORATE.
  -- Qualsiasi altro valore (ADMIN compreso) diventa VOLUNTEER.
  v_role := case upper(coalesce(new.raw_user_meta_data->>'role', ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;

  insert into public.profiles (id,email,email_confirmed,full_name,avatar_url,role,npo_name,company_name,npo_vat_id,referral_code)
  values (new.id,new.email,coalesce(new.email_confirmed_at is not null,false),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'displayName'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar'),
    v_role,
    coalesce(new.raw_user_meta_data->>'npo_name', new.raw_user_meta_data->>'npoName'),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName'),
    new.raw_user_meta_data->>'npo_vat_id', public.generate_referral_code(new.id))
  on conflict (id) do update set email = excluded.email, email_confirmed = excluded.email_confirmed, updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_my_profile(p_role text default null::text, p_full_name text default null::text, p_npo_name text default null::text, p_company_name text default null::text, p_avatar_url text default null::text, p_profile_completed boolean default null::boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  v_role := case upper(coalesce(p_role, ''))
    when 'NPO' then 'NPO'::public.user_role
    when 'CORPORATE' then 'CORPORATE'::public.user_role
    else 'VOLUNTEER'::public.user_role
  end;
  insert into public.profiles (id, email, full_name, avatar_url, role, npo_name, company_name, profile_completed, referral_code)
  values (v_uid, v_email, p_full_name, p_avatar_url, v_role, p_npo_name, p_company_name, coalesce(p_profile_completed, false), public.generate_referral_code(v_uid))
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    npo_name = coalesce(public.profiles.npo_name, excluded.npo_name),
    company_name = coalesce(public.profiles.company_name, excluded.company_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
end;
$$;

-- 3) Il proprio codice, creato lato server se manca (sostituisce la scrittura diretta dal client).
create or replace function public.ensure_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select referral_code into v_code from public.profiles where id = v_uid;
  if not found then
    return null;
  end if;
  if v_code is null then
    v_code := public.generate_referral_code(v_uid);
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles set referral_code = v_code, updated_at = now() where id = v_uid and referral_code is null;
    perform set_config('app.bypass_profile_guard', 'false', true);
    select referral_code into v_code from public.profiles where id = v_uid;
  end if;
  return v_code;
end;
$$;
revoke all on function public.ensure_my_referral_code() from public, anon;
grant execute on function public.ensure_my_referral_code() to authenticated;

-- 4) "Invitato da": solo con un codice valido inserito dall'utente, una volta sola, mai se stessi.
create or replace function public.set_my_referrer(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_referrer uuid;
  v_current uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_code = '' then
    return jsonb_build_object('status', 'empty');
  end if;

  select referred_by into v_current from public.profiles where id = v_uid;
  if v_current is not null then
    return jsonb_build_object('status', 'already_set');
  end if;

  select id into v_referrer from public.profiles where upper(referral_code) = v_code;
  if v_referrer is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_referrer = v_uid then
    return jsonb_build_object('status', 'self');
  end if;

  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.profiles set referred_by = v_referrer, updated_at = now()
   where id = v_uid and referred_by is null;
  perform set_config('app.bypass_profile_guard', 'false', true);
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.set_my_referrer(text) from public, anon;
grant execute on function public.set_my_referrer(text) to authenticated;

-- 5) Trigger di protezione: oltre a ruolo/ban/verifica/punti anche created_at, badges,
--    referred_by, referral_code (scritti solo da funzioni server con bypass).
--    email/email_confirmed NON ancora: la sync da auth.users va prima dotata di bypass (A22, secondo giro).
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and coalesce(current_setting('app.bypass_profile_guard', true), 'false') is distinct from 'true' then
    new.is_verified := old.is_verified;
    new.impact_points := old.impact_points;
    new.verification_status := old.verification_status;
    new.role := old.role;
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.ban_report_id := old.ban_report_id;
    new.created_at := old.created_at;
    new.badges := old.badges;
    new.referred_by := old.referred_by;
    new.referral_code := old.referral_code;
  end if;
  return new;
end;
$$;

-- 6) Backfill: tutti i codici in MAIUSCOLO, e un codice per chi non ce l'ha. referred_by non si tocca.
do $$
declare r record;
begin
  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.profiles set referral_code = upper(referral_code)
   where referral_code is not null and referral_code <> upper(referral_code);
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public.generate_referral_code(r.id) where id = r.id;
  end loop;
  perform set_config('app.bypass_profile_guard', 'false', true);
end $$;
