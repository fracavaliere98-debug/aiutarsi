-- La migrazione 2026-07-15 (security_hardening_rls_and_definer_functions) ha rimosso
-- is_verified/impact_points/verification_status dal payload accettato da
-- update_my_profile_core, assumendo che quella fosse la via di scrittura del profilo.
-- In realtà il client non chiama mai quella RPC: aggiorna "profiles" con una PATCH REST
-- diretta (services/AuthService.ts -> profileRest.updateVolunteerProfile), che passa
-- solo dalla RLS "id = auth.uid()" — nessuna restrizione per colonna. Verificato che
-- qualunque utente autenticato può auto-impostare is_verified=true e impact_points a
-- piacere con una singola PATCH su /rest/v1/profiles.
--
-- Fix strutturale, indipendente dal percorso client (RPC o REST diretto): un trigger
-- BEFORE UPDATE che ripristina questi tre campi al valore precedente per qualsiasi
-- chiamante che non sia service_role.
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.is_verified := old.is_verified;
    new.impact_points := old.impact_points;
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_fields_trigger on public.profiles;

create trigger protect_privileged_profile_fields_trigger
before update on public.profiles
for each row
execute function public.protect_privileged_profile_fields();
