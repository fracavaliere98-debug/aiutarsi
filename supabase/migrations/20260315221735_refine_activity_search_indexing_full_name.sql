CREATE OR REPLACE FUNCTION public.get_activities_with_match(p_user_id uuid, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_center_lat double precision DEFAULT NULL::double precision, p_center_lng double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 50, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_skills text[] DEFAULT '{}'::text[], p_only_urgent boolean DEFAULT false, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_statuses text[] DEFAULT '{APERTA}'::text[])
 RETURNS TABLE(id uuid, npo_id uuid, npo_name text, title text, description text, category text, location_address text, location_lat double precision, location_lng double precision, image_url text, is_urgent boolean, status text, date_start timestamp with time zone, date_end timestamp with time zone, slots_total integer, match_percentage integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_embedding vector(384);
  v_user_interests text[];
  v_user_skills text[];
  v_has_profile_data boolean := false;
BEGIN
  -- 1. Get user data
  IF p_user_id IS NOT NULL THEN
    SELECT embedding INTO v_user_embedding FROM public.profiles WHERE public.profiles.id = p_user_id;
    SELECT array_agg(interest) INTO v_user_interests FROM public.user_interests WHERE user_id = p_user_id;
    SELECT array_agg(skill) INTO v_user_skills FROM public.user_skills WHERE user_id = p_user_id;
    
    IF v_user_embedding IS NOT NULL OR v_user_interests IS NOT NULL OR v_user_skills IS NOT NULL THEN
      v_has_profile_data := true;
    END IF;
  END IF;

  -- Default to empty arrays if null
  v_user_interests := COALESCE(v_user_interests, '{}'::text[]);
  v_user_skills := COALESCE(v_user_skills, '{}'::text[]);

  RETURN QUERY
  WITH filtered_activities AS (
    SELECT 
      a.*,
      COALESCE(p.npo_name, p.full_name) AS npo_computed_name
    FROM public.activities a
    LEFT JOIN public.profiles p ON a.npo_id = p.id
    WHERE (p_category IS NULL OR p_category = 'Tutti' OR a.category = p_category)
      AND (
        p_search IS NULL 
        OR a.title ILIKE '%' || p_search || '%' 
        OR a.description ILIKE '%' || p_search || '%'
        OR p.npo_name ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
      )
      AND (p_statuses IS NULL OR a.status::text = ANY(p_statuses))
      AND (p_only_urgent IS FALSE OR a.is_urgent IS TRUE)
      AND (p_date_from IS NULL OR a.date_start >= p_date_from)
      AND (p_date_to IS NULL OR a.date_start <= p_date_to)
      AND (
        p_center_lat IS NULL OR 
        earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(a.location_lat, a.location_lng)) < p_radius_km * 1000
      )
      AND (
        array_length(p_skills, 1) IS NULL OR 
        EXISTS (
          SELECT 1 FROM public.activity_skills s 
          WHERE s.activity_id = a.id AND s.skill = ANY(p_skills)
        )
      )
      AND (
        p_user_id IS NULL
        OR (
          a.npo_id NOT IN (
            SELECT bu.blocker_id FROM public.blocked_users bu WHERE bu.blocked_id = p_user_id
          )
          AND a.npo_id NOT IN (
            SELECT bu.blocked_id FROM public.blocked_users bu WHERE bu.blocker_id = p_user_id
          )
        )
      )
  ),
  scored_activities AS (
    SELECT 
      fa.*,
      CASE 
        WHEN v_user_embedding IS NOT NULL AND fa.embedding IS NOT NULL 
        THEN 1 - (fa.embedding <=> v_user_embedding) 
        ELSE 0.6
      END AS semantic_sim,
      (
        SELECT COUNT(*) 
        FROM public.activity_skills s 
        WHERE s.activity_id = fa.id AND s.skill = ANY(v_user_skills)
      ) AS user_skills_match_count,
      CASE WHEN fa.category = ANY(v_user_interests) THEN 1 ELSE 0 END AS interest_match
    FROM filtered_activities fa
  )
  SELECT 
    sa.id,
    sa.npo_id,
    sa.npo_computed_name as npo_name,
    sa.title,
    sa.description,
    sa.category,
    sa.location_address,
    sa.location_lat,
    sa.location_lng,
    sa.image_url,
    sa.is_urgent,
    sa.status::text,
    sa.date_start,
    sa.date_end,
    sa.slots_total,
    LEAST(100, ROUND(
      CASE 
        WHEN v_has_profile_data THEN
          (sa.semantic_sim * 50) +
          LEAST(20, (sa.user_skills_match_count * 10)) +
          (sa.interest_match * 15) +
          CASE 
            WHEN p_center_lat IS NOT NULL AND sa.location_lat IS NOT NULL 
            THEN 
              CASE 
                WHEN earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(sa.location_lat, sa.location_lng)) < 5000 THEN 10
                WHEN earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(sa.location_lat, sa.location_lng)) < 15000 THEN 7
                WHEN earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(sa.location_lat, sa.location_lng)) < 50000 THEN 4
                ELSE 0
              END
            ELSE 5
          END +
          CASE WHEN sa.is_urgent THEN 5 ELSE 0 END
        ELSE
          60 + 
          CASE 
            WHEN p_center_lat IS NOT NULL AND sa.location_lat IS NOT NULL 
            THEN 
              CASE 
                WHEN earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(sa.location_lat, sa.location_lng)) < 5000 THEN 25
                WHEN earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(sa.location_lat, sa.location_lng)) < 15000 THEN 20
                WHEN earth_distance(ll_to_earth(p_center_lat, p_center_lng), ll_to_earth(sa.location_lat, sa.location_lng)) < 50000 THEN 15
                ELSE 0
              END
            ELSE 10
          END +
          CASE WHEN sa.category = p_category THEN 10 ELSE 0 END +
          CASE WHEN sa.is_urgent THEN 5 ELSE 0 END
      END
    ))::int AS match_percentage
  FROM scored_activities sa
  ORDER BY match_percentage DESC, sa.date_start ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;;
