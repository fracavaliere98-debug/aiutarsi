-- A28: stato di verifica degli enti, una sola fonte.
-- Regola: profiles.verification_status e' l'unica fonte; profiles.is_verified e' derivata
-- (is_verified = (verification_status = 'verified')) e la imposta solo il database.
-- verification_requests resta storico + note. Il passaggio a 'pending' lo fa il database
-- quando arriva una richiesta; approvazione/rifiuto avvengono in una sola funzione atomica.

-- 1. Derivazione di is_verified (BEFORE INSERT/UPDATE, dopo protect_privileged_profile_fields_trigger
--    perche' i trigger BEFORE girano in ordine alfabetico: "protect_..." < "sync_...").
create or replace function public.sync_is_verified_from_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Un client non puo' creare un profilo gia' verificato.
  if tg_op = 'INSERT'
     and auth.role() is distinct from 'service_role'
     and coalesce(current_setting('app.bypass_profile_guard', true), 'false') is distinct from 'true' then
    new.verification_status := 'none';
  end if;

  new.verification_status := coalesce(new.verification_status, 'none');
  new.is_verified := (new.verification_status = 'verified');
  return new;
end;
$$;

revoke all on function public.sync_is_verified_from_status() from public, anon, authenticated;

drop trigger if exists sync_is_verified_trigger on public.profiles;
create trigger sync_is_verified_trigger
  before insert or update on public.profiles
  for each row execute function public.sync_is_verified_from_status();

-- 2. Una richiesta in attesa porta il profilo a 'pending' (se non e' gia' verificato).
create or replace function public.set_profile_pending_on_verification_request()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status = 'pending' then
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.profiles
       set verification_status = 'pending', updated_at = now()
     where id = new.user_id
       and verification_status in ('none', 'rejected');
    perform set_config('app.bypass_profile_guard', 'false', true);
  end if;
  return new;
end;
$$;

revoke all on function public.set_profile_pending_on_verification_request() from public, anon, authenticated;

drop trigger if exists verification_request_sets_pending on public.verification_requests;
create trigger verification_request_sets_pending
  after insert on public.verification_requests
  for each row execute function public.set_profile_pending_on_verification_request();

-- 3. Approvazione/rifiuto atomici: richiesta + profilo nella stessa transazione.
create or replace function public.admin_review_verification(
  p_request_id uuid,
  p_approve boolean,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user uuid;
  v_status text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN') then
    raise exception 'not authorized';
  end if;

  select user_id, status into v_user, v_status
    from public.verification_requests
   where id = p_request_id
     for update;

  if not found then
    raise exception 'verification request not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'verification request already reviewed';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_notes = p_notes,
         updated_at = now()
   where id = p_request_id;

  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.profiles
     set verification_status = case when p_approve then 'verified' else 'rejected' end,
         updated_at = now()
   where id = v_user;
  perform set_config('app.bypass_profile_guard', 'false', true);

  return v_user;
end;
$$;

revoke all on function public.admin_review_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;

-- 4. Una sola via di scrittura: la vecchia funzione (scriveva is_verified e verification_status a mano) esce.
drop function if exists public.admin_set_npo_verification(uuid, boolean, text);

-- 5. Riallineamento dei dati esistenti (una sola istruzione, cosi' il bypass vale per tutta l'operazione).
--    - chi aveva is_verified = true (quello che il server usava davvero) diventa 'verified';
--    - chi aveva 'verified' con is_verified falso diventa is_verified = true (lo ricalcola il trigger).
do $$
begin
  perform set_config('app.bypass_profile_guard', 'true', true);

  update public.profiles
     set verification_status = 'verified'
   where is_verified is true
     and verification_status is distinct from 'verified';

  update public.profiles
     set updated_at = updated_at
   where coalesce(is_verified, false) is distinct from (coalesce(verification_status, 'none') = 'verified');

  perform set_config('app.bypass_profile_guard', 'false', true);
end;
$$;

-- 6. Vincolo: i due campi non possono piu' divergere.
alter table public.profiles
  drop constraint if exists profiles_is_verified_matches_status;
alter table public.profiles
  add constraint profiles_is_verified_matches_status
  check (coalesce(is_verified, false) = (coalesce(verification_status, 'none') = 'verified'));

-- ROLLBACK (non eseguire insieme alla migrazione):
--   alter table public.profiles drop constraint if exists profiles_is_verified_matches_status;
--   drop trigger if exists sync_is_verified_trigger on public.profiles;
--   drop trigger if exists verification_request_sets_pending on public.verification_requests;
--   drop function if exists public.sync_is_verified_from_status();
--   drop function if exists public.set_profile_pending_on_verification_request();
--   drop function if exists public.admin_review_verification(uuid, boolean, text);
--   -- ricreare admin_set_npo_verification da 20260722090000_admin_npo_verification_rpc.sql
--   -- (i dati riallineati restano: non c'e' motivo di riportarli indietro)
