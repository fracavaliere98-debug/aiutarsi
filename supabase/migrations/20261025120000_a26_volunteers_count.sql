-- A26: contatore dei volontari per la landing (anche per utenti non loggati).
-- Dopo P2 la tabella profiles non e' piu' leggibile da anon e per gli altri utenti conta solo le righe visibili:
-- questa funzione restituisce solo il numero, nessun dato personale.
create or replace function public.get_volunteers_count()
returns bigint
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*) from public.profiles where role = 'VOLUNTEER';
$$;

revoke all on function public.get_volunteers_count() from public;
grant execute on function public.get_volunteers_count() to anon, authenticated;
