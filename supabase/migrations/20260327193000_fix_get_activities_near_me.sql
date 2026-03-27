drop function if exists public.get_activities_near_me(double precision, double precision, double precision);

create or replace function public.get_activities_near_me(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision
)
returns table(
  id uuid,
  npo_id uuid,
  npo_name text,
  title text,
  description text,
  category text,
  location_address text,
  location_lat double precision,
  location_lng double precision,
  image_url text,
  is_urgent boolean,
  status text,
  date_start timestamptz,
  date_end timestamptz,
  slots_total integer,
  match_percentage integer,
  distance_meters double precision,
  participants_count integer,
  skills_array text[]
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.npo_id,
    coalesce(p.npo_name, p.full_name, 'NPO Sconosciuta') as npo_name,
    a.title,
    a.description,
    a.category,
    a.location_address,
    a.location_lat,
    a.location_lng,
    a.image_url,
    coalesce(a.is_urgent, false) as is_urgent,
    a.status::text as status,
    a.date_start,
    a.date_end,
    coalesce(a.slots_total, 0)::integer as slots_total,
    coalesce(a.match_percentage, 0)::integer as match_percentage,
    earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(a.location_lat, a.location_lng)
    )::double precision as distance_meters,
    (
      select count(*)::integer
      from public.activity_participants ap
      where ap.activity_id = a.id
        and ap.status in ('REGISTERED', 'APPROVED', 'PENDING')
    ) as participants_count,
    coalesce(
      (
        select array_agg(distinct s.skill order by s.skill)
        from public.activity_skills s
        where s.activity_id = a.id
      ),
      '{}'::text[]
    ) as skills_array
  from public.activities a
  left join public.profiles p on p.id = a.npo_id
  where a.location_lat is not null
    and a.location_lng is not null
    and a.status in ('APERTA', 'IN_CORSO')
    and earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(a.location_lat, a.location_lng)
    ) <= radius_meters
  order by distance_meters asc, a.date_start asc;
$$;
