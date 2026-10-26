-- P11 (2026-10-26). Regola di Francesco: la posizione del volontario non la vede nessuno, serve solo in
-- background per proporre attivita'. In piu': "Posizione preferita", scelta dal volontario tra i capoluoghi di
-- provincia italiani, mostrata sul profilo SOLO se lui la rende pubblica.
--  1) la posizione testuale (profiles.location_string) dei volontari viene azzerata e non puo' piu' esistere;
--  2) get_public_profiles restituisce location_string solo per NPO e CORPORATE (la sede);
--  3) tabella dei capoluoghi (119 comuni capoluogo, fonte tuttitalia.it, dati al 01/01/2026);
--  4) preferenza per utente in tabella a parte: la visibilita' e' di riga (RLS), non di colonna.
-- Le coordinate (location_lat/lng/coords) non cambiano: nessun SELECT per gli utenti, le legge solo il server.

-- 1) trigger: un volontario non ha posizione testuale
create or replace function public.clear_volunteer_location_string()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role = 'VOLUNTEER'::public.user_role then
    new.location_string := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_volunteer_location_string on public.profiles;
create trigger trg_clear_volunteer_location_string
  before insert or update on public.profiles
  for each row execute function public.clear_volunteer_location_string();

update public.profiles set location_string = null
 where role = 'VOLUNTEER'::public.user_role and location_string is not null;

-- 2) get_public_profiles: location_string solo per NPO e CORPORATE (patch della definizione corrente, A29/A30)
do $mig$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.get_public_profiles(uuid[], public.user_role, integer, integer)'::regprocedure);
  v_def := replace(
    v_def,
    'case when a.access <> ''limited'' then a.location_string end',
    'case when a.access <> ''limited'' and a.role in (''NPO'', ''CORPORATE'') then a.location_string end'
  );
  if position('a.role in (''NPO'', ''CORPORATE'') then a.location_string end' in v_def) = 0 then
    raise exception 'get_public_profiles: location_string line not found, migration aborted';
  end if;
  execute v_def;
end
$mig$;

-- 3) capoluoghi di provincia
create table if not exists public.italian_provincial_capitals (
  code text primary key,
  name text not null,
  province_code text not null,
  region text not null
);
alter table public.italian_provincial_capitals enable row level security;
drop policy if exists "Capitals readable by signed-in users" on public.italian_provincial_capitals;
create policy "Capitals readable by signed-in users" on public.italian_provincial_capitals
  for select to authenticated using (true);
revoke all on table public.italian_provincial_capitals from anon, authenticated;
grant select on table public.italian_provincial_capitals to authenticated;

insert into public.italian_provincial_capitals (code, name, province_code, region)
select lower(regexp_replace(translate(v.n, 'ìò', 'io'), '[^a-zA-Z0-9]+', '-', 'g')), v.n, v.p, v.r
from (values ('Agrigento','AG','Sicilia'),('Alessandria','AL','Piemonte'),('Ancona','AN','Marche'),('Andria','BT','Puglia'),('Aosta','AO','Valle d''Aosta'),('Arezzo','AR','Toscana'),('Ascoli Piceno','AP','Marche'),('Asti','AT','Piemonte'),('Avellino','AV','Campania'),('Bari','BA','Puglia'),('Barletta','BT','Puglia'),('Belluno','BL','Veneto'),('Benevento','BN','Campania'),('Bergamo','BG','Lombardia'),('Biella','BI','Piemonte'),('Bologna','BO','Emilia-Romagna'),('Bolzano','BZ','Trentino-Alto Adige'),('Brescia','BS','Lombardia'),('Brindisi','BR','Puglia'),('Cagliari','CA','Sardegna'),('Caltanissetta','CL','Sicilia'),('Campobasso','CB','Molise'),('Carbonia','SU','Sardegna'),('Carrara','MS','Toscana'),('Caserta','CE','Campania'),('Catania','CT','Sicilia'),('Catanzaro','CZ','Calabria'),('Cesena','FC','Emilia-Romagna'),('Chieti','CH','Abruzzo'),('Como','CO','Lombardia'),('Cosenza','CS','Calabria'),('Cremona','CR','Lombardia'),('Crotone','KR','Calabria'),('Cuneo','CN','Piemonte'),('Enna','EN','Sicilia'),('Fermo','FM','Marche'),('Ferrara','FE','Emilia-Romagna'),('Firenze','FI','Toscana'),('Foggia','FG','Puglia'),('Forlì','FC','Emilia-Romagna'),('Frosinone','FR','Lazio'),('Genova','GE','Liguria'),('Gorizia','GO','Friuli-Venezia Giulia'),('Grosseto','GR','Toscana'),('Iglesias','SU','Sardegna'),('Imperia','IM','Liguria'),('Isernia','IS','Molise'),('L''Aquila','AQ','Abruzzo'),('La Spezia','SP','Liguria'),('Lanusei','OG','Sardegna'),('Latina','LT','Lazio'),('Lecce','LE','Puglia'),('Lecco','LC','Lombardia'),('Livorno','LI','Toscana'),('Lodi','LO','Lombardia'),('Lucca','LU','Toscana'),('Macerata','MC','Marche'),('Mantova','MN','Lombardia'),('Massa','MS','Toscana'),('Matera','MT','Basilicata'),('Messina','ME','Sicilia'),('Milano','MI','Lombardia'),('Modena','MO','Emilia-Romagna'),('Monza','MB','Lombardia'),('Napoli','NA','Campania'),('Novara','NO','Piemonte'),('Nuoro','NU','Sardegna'),('Olbia','OT','Sardegna'),('Oristano','OR','Sardegna'),('Padova','PD','Veneto'),('Palermo','PA','Sicilia'),('Parma','PR','Emilia-Romagna'),('Pavia','PV','Lombardia'),('Perugia','PG','Umbria'),('Pesaro','PU','Marche'),('Pescara','PE','Abruzzo'),('Piacenza','PC','Emilia-Romagna'),('Pisa','PI','Toscana'),('Pistoia','PT','Toscana'),('Pordenone','PN','Friuli-Venezia Giulia'),('Potenza','PZ','Basilicata'),('Prato','PO','Toscana'),('Ragusa','RG','Sicilia'),('Ravenna','RA','Emilia-Romagna'),('Reggio Calabria','RC','Calabria'),('Reggio Emilia','RE','Emilia-Romagna'),('Rieti','RI','Lazio'),('Rimini','RN','Emilia-Romagna'),('Roma','RM','Lazio'),('Rovigo','RO','Veneto'),('Salerno','SA','Campania'),('Sanluri','VS','Sardegna'),('Sassari','SS','Sardegna'),('Savona','SV','Liguria'),('Siena','SI','Toscana'),('Siracusa','SR','Sicilia'),('Sondrio','SO','Lombardia'),('Taranto','TA','Puglia'),('Tempio Pausania','OT','Sardegna'),('Teramo','TE','Abruzzo'),('Terni','TR','Umbria'),('Torino','TO','Piemonte'),('Tortolì','OG','Sardegna'),('Trani','BT','Puglia'),('Trapani','TP','Sicilia'),('Trento','TN','Trentino-Alto Adige'),('Treviso','TV','Veneto'),('Trieste','TS','Friuli-Venezia Giulia'),('Udine','UD','Friuli-Venezia Giulia'),('Urbino','PU','Marche'),('Varese','VA','Lombardia'),('Venezia','VE','Veneto'),('Verbania','VB','Piemonte'),('Vercelli','VC','Piemonte'),('Verona','VR','Veneto'),('Vibo Valentia','VV','Calabria'),('Vicenza','VI','Veneto'),('Villacidro','VS','Sardegna'),('Viterbo','VT','Lazio')) as v(n, p, r)
on conflict (code) do nothing;

-- 4) posizione preferita del volontario
create table if not exists public.volunteer_preferred_city (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  city_code text not null references public.italian_provincial_capitals(code),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.volunteer_preferred_city enable row level security;
drop policy if exists "Preferred city visible by rule" on public.volunteer_preferred_city;
create policy "Preferred city visible by rule" on public.volunteer_preferred_city
  for select to authenticated
  using (user_id = (select auth.uid()) or (is_public and public.can_view_profile_row(user_id)));
revoke all on table public.volunteer_preferred_city from anon, authenticated;
grant select on table public.volunteer_preferred_city to authenticated;

create or replace function public.set_my_preferred_city(p_city_code text, p_is_public boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_code text := nullif(lower(trim(coalesce(p_city_code, ''))), '');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'VOLUNTEER'::public.user_role then
    return jsonb_build_object('status', 'not_volunteer');
  end if;
  if v_code is null then
    delete from public.volunteer_preferred_city where user_id = v_uid;
    return jsonb_build_object('status', 'cleared');
  end if;
  if not exists (select 1 from public.italian_provincial_capitals where code = v_code) then
    return jsonb_build_object('status', 'unknown_city');
  end if;
  insert into public.volunteer_preferred_city (user_id, city_code, is_public, updated_at)
  values (v_uid, v_code, coalesce(p_is_public, false), now())
  on conflict (user_id) do update
    set city_code = excluded.city_code, is_public = excluded.is_public, updated_at = now();
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.set_my_preferred_city(text, boolean) from public, anon;
grant execute on function public.set_my_preferred_city(text, boolean) to authenticated;
