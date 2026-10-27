-- A26 P7: niente minorenni, controllo anche sul server.
-- Prima il divieto 18+ esisteva solo nel client (onboarding/profile.tsx): chiamando direttamente
-- l'API si poteva salvare una data di nascita da minorenne, o completare il profilo senza data.
-- Ora un trigger su profiles rifiuta con ADULT_REQUIRED:
--  1) una data di nascita che renda l'utente minorenne (o impossibile, prima del 1900);
--  2) un VOLONTARIO che completa il profilo (profile_completed da falso a vero) senza data di nascita.
-- I profili esistenti non cambiano: la regola scatta solo quando si scrive la data o si completa il profilo.

create or replace function public.enforce_adult_profile()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.date_of_birth is not null
     and (tg_op = 'INSERT' or new.date_of_birth is distinct from old.date_of_birth)
     and (new.date_of_birth > (current_date - interval '18 years')::date
          or new.date_of_birth < date '1900-01-01') then
    raise exception 'ADULT_REQUIRED' using errcode = '23514';
  end if;

  if new.role::text = 'VOLUNTEER'
     and coalesce(new.profile_completed, false)
     and (tg_op = 'INSERT' or not coalesce(old.profile_completed, false))
     and new.date_of_birth is null then
    raise exception 'ADULT_REQUIRED' using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_adult_profile_trigger on public.profiles;
create trigger enforce_adult_profile_trigger
  before insert or update of date_of_birth, profile_completed on public.profiles
  for each row execute function public.enforce_adult_profile();
