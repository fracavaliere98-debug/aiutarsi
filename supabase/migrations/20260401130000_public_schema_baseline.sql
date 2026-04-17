


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."activity_status" AS ENUM (
    'APERTA',
    'IN_CORSO',
    'COMPLETATA',
    'CANCELLATA'
);


ALTER TYPE "public"."activity_status" OWNER TO "postgres";


CREATE TYPE "public"."application_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE "public"."application_status" OWNER TO "postgres";


CREATE TYPE "public"."conversation_type" AS ENUM (
    'PRIVATE',
    'ACTIVITY_GROUP'
);


ALTER TYPE "public"."conversation_type" OWNER TO "postgres";


CREATE TYPE "public"."participation_status" AS ENUM (
    'REGISTERED',
    'CHECKED_IN',
    'CANCELLED',
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE "public"."participation_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'VOLUNTEER',
    'NPO',
    'CORPORATE',
    'ADMIN'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_sync_chat_on_participation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_conversation_id UUID;
    v_activity_title TEXT;
BEGIN
    -- Only act if status becomes APPROVED or REGISTERED
    IF (NEW.status IN ('APPROVED', 'REGISTERED')) AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'REGISTERED')) THEN
        
        -- Get the activity title
        SELECT title INTO v_activity_title FROM public.activities WHERE id = NEW.activity_id;

        -- Find the group conversation for this activity
        SELECT id INTO v_conversation_id 
        FROM public.conversations 
        WHERE type = 'ACTIVITY_GROUP' AND activity_id = NEW.activity_id
        LIMIT 1;

        -- If the conversation doesn't exist, create it (best effort)
        IF v_conversation_id IS NULL THEN
            INSERT INTO public.conversations (type, activity_id)
            VALUES ('ACTIVITY_GROUP', NEW.activity_id)
            RETURNING id INTO v_conversation_id;
        END IF;

        -- Add the user to the conversation
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, NEW.user_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
        
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_sync_chat_on_participation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "record") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_duration_hours float;
    v_xp integer;
    v_state gamification_state%ROWTYPE;
    v_new_count integer;
    v_new_hours float;
    v_bonus_xp integer := 0;
    v_start_hour integer;
    v_profile record;
BEGIN
    v_duration_hours := EXTRACT(EPOCH FROM (p_activity_record.date_end - p_activity_record.date_start)) / 3600.0;
    v_start_hour := EXTRACT(HOUR FROM (p_activity_record.date_start AT TIME ZONE 'UTC'));

    -- Base XP
    IF v_duration_hours > 6 THEN v_xp := 200;
    ELSIF v_duration_hours > 3 THEN v_xp := 150;
    ELSE v_xp := 100;
    END IF;

    SELECT * INTO v_state FROM gamification_state WHERE user_id = p_user_id;
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    
    -- Check if already processed
    IF v_state.processed_activity_ids @> array[p_activity_record.id] THEN
        RETURN;
    END IF;

    v_new_count := COALESCE(v_state.completed_activities_count, 0) + 1;
    v_new_hours := COALESCE(v_state.total_hours, 0) + v_duration_hours;

    -- Badges evaluation
    IF v_new_count = 1 THEN
        PERFORM award_gamification_xp(p_user_id, 0, '{"id": "debt", "name": "Debuttante", "icon": "🌱", "description": "Hai completato la tua prima attività!", "color": "bg-green-100"}'::jsonb);
    ELSIF v_new_count = 10 THEN
        PERFORM award_gamification_xp(p_user_id, 0, '{"id": "pila", "name": "Pilastro", "icon": "🏛️", "description": "Hai completato 10 attività. Solido come una roccia.", "color": "bg-blue-100"}'::jsonb);
    END IF;

    IF v_duration_hours > 6.0 THEN
        PERFORM award_gamification_xp(p_user_id, 0, '{"id": "stac", "name": "Stacanovista", "icon": "🏎️", "description": "Hai partecipato a una maratona di volontariato (>6h). Wow!", "color": "bg-red-100"}'::jsonb);
    END IF;

    IF p_activity_record.category IS NOT NULL AND NOT (v_state.completed_categories @> array[p_activity_record.category]) THEN
        IF array_length(array_append(v_state.completed_categories, p_activity_record.category), 1) >= 3 THEN
            PERFORM award_gamification_xp(p_user_id, 300, '{"id": "tutt", "name": "Tuttofare", "icon": "🛠️", "description": "Hai partecipato ad attività in 3 categorie differenti.", "color": "bg-orange-100"}'::jsonb);
        END IF;
        UPDATE gamification_state SET completed_categories = array_append(completed_categories, p_activity_record.category) WHERE user_id = p_user_id;
    END IF;

    IF v_start_hour >= 20 OR v_start_hour < 7 THEN
        PERFORM award_gamification_xp(p_user_id, 350, '{"id": "gufo", "name": "Gufo Notturno", "icon": "🦉", "description": "Hai partecipato ad un''attività notturna!", "color": "bg-slate-200"}'::jsonb);
    END IF;

    IF v_new_hours >= 100.0 AND NOT (v_state.badges @> '[{"id": "vete"}]'::jsonb) THEN
        PERFORM award_gamification_xp(p_user_id, 1000, '{"id": "vete", "name": "Veterano", "icon": "🏅", "description": "Hai superato le 100 ore di volontariato. Un vero leader.", "color": "bg-yellow-100"}'::jsonb);
    END IF;

    IF v_profile.created_at < (NOW() - INTERVAL '1 year') AND NOT (v_state.badges @> '[{"id": "anni"}]'::jsonb) THEN
        PERFORM award_gamification_xp(p_user_id, 1200, '{"id": "anni", "name": "Anniversario", "icon": "🎂", "description": "Rimani attivo nella community per un intero anno.", "color": "bg-pink-100"}'::jsonb);
    END IF;

    UPDATE gamification_state SET completion_dates = array_append(completion_dates, CURRENT_DATE::text) WHERE user_id = p_user_id;

    IF v_new_count % 10 = 0 THEN
        v_bonus_xp := 1000;
    END IF;

    UPDATE gamification_state
    SET completed_activities_count = v_new_count,
        total_hours = v_new_hours,
        processed_activity_ids = array_append(processed_activity_ids, p_activity_record.id)
    WHERE user_id = p_user_id;

    PERFORM award_gamification_xp(p_user_id, v_xp + v_bonus_xp, NULL);
END;
$$;


ALTER FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "record") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "npo_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "date_start" timestamp with time zone NOT NULL,
    "date_end" timestamp with time zone NOT NULL,
    "location_address" "text",
    "location_lat" double precision,
    "location_lng" double precision,
    "slots_total" integer DEFAULT 0,
    "category" "text",
    "status" "public"."activity_status" DEFAULT 'APERTA'::"public"."activity_status",
    "match_percentage" double precision DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    "is_urgent" boolean DEFAULT false,
    "location_coords" "public"."geography"(Point,4326),
    "embedding" "public"."vector"(384),
    "recurrence" "text",
    CONSTRAINT "activities_recurrence_check" CHECK (("recurrence" = ANY (ARRAY['WEEKLY'::"text", 'MONTHLY'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "public"."activities") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_duration_hours float;
    v_xp integer;
    v_state gamification_state%ROWTYPE;
    v_new_count integer;
    v_new_hours float;
    v_bonus_xp integer := 0;
    v_start_hour integer;
    v_profile record;
BEGIN
    v_duration_hours := EXTRACT(EPOCH FROM (p_activity_record.date_end - p_activity_record.date_start)) / 3600.0;
    v_start_hour := EXTRACT(HOUR FROM (p_activity_record.date_start AT TIME ZONE 'UTC'));

    -- Base XP
    IF v_duration_hours > 6 THEN v_xp := 200;
    ELSIF v_duration_hours > 3 THEN v_xp := 150;
    ELSE v_xp := 100;
    END IF;

    SELECT * INTO v_state FROM gamification_state WHERE user_id = p_user_id;
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    
    -- Check if already processed
    IF v_state.processed_activity_ids @> array[p_activity_record.id] THEN
        RETURN;
    END IF;

    v_new_count := COALESCE(v_state.completed_activities_count, 0) + 1;
    v_new_hours := COALESCE(v_state.total_hours, 0) + v_duration_hours;

    -- Badges evaluation
    IF v_new_count = 1 THEN
        PERFORM award_gamification_xp(p_user_id, 0, '{"id": "debt", "name": "Debuttante", "icon": "🌱", "description": "Hai completato la tua prima attività!", "color": "bg-green-100"}'::jsonb);
        
        -- REFERRAL LOGIC: Award "Coppia Vincente" badge and 500 XP to both
        IF v_profile.referred_by IS NOT NULL THEN
            -- Award to the new user
            PERFORM award_gamification_xp(p_user_id, 500, '{"id": "copp", "name": "Coppia Vincente", "icon": "👫", "description": "Hai completato la tua prima missione con un amico!", "color": "bg-purple-100"}'::jsonb);
            -- Award to the referrer
            PERFORM award_gamification_xp(v_profile.referred_by, 500, '{"id": "copp", "name": "Coppia Vincente", "icon": "👫", "description": "Il tuo amico ha completato la sua prima missione!", "color": "bg-purple-100"}'::jsonb);
        END IF;
        
    ELSIF v_new_count = 10 THEN
        PERFORM award_gamification_xp(p_user_id, 0, '{"id": "pila", "name": "Pilastro", "icon": "🏛️", "description": "Hai completato 10 attività. Solido come una roccia.", "color": "bg-blue-100"}'::jsonb);
    END IF;

    IF v_duration_hours > 6.0 THEN
        PERFORM award_gamification_xp(p_user_id, 0, '{"id": "stac", "name": "Stacanovista", "icon": "🏎️", "description": "Hai partecipato a una maratona di volontariato (>6h). Wow!", "color": "bg-red-100"}'::jsonb);
    END IF;

    IF p_activity_record.category IS NOT NULL AND NOT (v_state.completed_categories @> array[p_activity_record.category]) THEN
        IF array_length(array_append(v_state.completed_categories, p_activity_record.category), 1) >= 3 THEN
            PERFORM award_gamification_xp(p_user_id, 300, '{"id": "tutt", "name": "Tuttofare", "icon": "🛠️", "description": "Hai partecipato ad attività in 3 categorie differenti.", "color": "bg-orange-100"}'::jsonb);
        END IF;
        UPDATE gamification_state SET completed_categories = array_append(completed_categories, p_activity_record.category) WHERE user_id = p_user_id;
    END IF;

    IF v_start_hour >= 20 OR v_start_hour < 7 THEN
        PERFORM award_gamification_xp(p_user_id, 350, '{"id": "gufo", "name": "Gufo Notturno", "icon": "🦉", "description": "Hai partecipato ad un''attività notturna!", "color": "bg-slate-200"}'::jsonb);
    END IF;

    IF v_new_hours >= 100.0 AND NOT (v_state.badges @> '[{"id": "vete"}]'::jsonb) THEN
        PERFORM award_gamification_xp(p_user_id, 1000, '{"id": "vete", "name": "Veterano", "icon": "🏅", "description": "Hai superato le 100 ore di volontariato. Un vero leader.", "color": "bg-yellow-100"}'::jsonb);
    END IF;

    IF v_profile.created_at < (NOW() - INTERVAL '1 year') AND NOT (v_state.badges @> '[{"id": "anni"}]'::jsonb) THEN
        PERFORM award_gamification_xp(p_user_id, 1200, '{"id": "anni", "name": "Anniversario", "icon": "🎂", "description": "Rimani attivo nella community per un intero anno.", "color": "bg-pink-100"}'::jsonb);
    END IF;

    UPDATE gamification_state SET completion_dates = array_append(completion_dates, CURRENT_DATE::text) WHERE user_id = p_user_id;

    IF v_new_count % 10 = 0 THEN
        v_bonus_xp := 1000;
    END IF;

    UPDATE gamification_state
    SET completed_activities_count = v_new_count,
        total_hours = v_new_hours,
        processed_activity_ids = array_append(processed_activity_ids, p_activity_record.id)
    WHERE user_id = p_user_id;

    PERFORM award_gamification_xp(p_user_id, v_xp + v_bonus_xp, NULL);
END;
$$;


ALTER FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "public"."activities") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_gamification_xp"("p_user_id" "uuid", "p_xp_amount" integer, "p_badge" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_state record;
    v_new_xp integer;
    v_new_level integer;
    v_badges jsonb;
    v_created_at timestamptz;
BEGIN
    -- Get or create state
    SELECT * INTO v_state FROM gamification_state WHERE user_id = p_user_id;

    -- Get profile creation date for Anniversario badge
    SELECT created_at INTO v_created_at FROM profiles WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO gamification_state (user_id, xp, level, badges, completed_activities_count, total_hours)
        VALUES (p_user_id, p_xp_amount, calculate_level_from_xp(p_xp_amount), COALESCE(jsonb_build_array(p_badge), '[]'::jsonb), 0, 0)
        RETURNING * INTO v_state;
    ELSE
        v_new_xp := v_state.xp + p_xp_amount;
        v_new_level := calculate_level_from_xp(v_new_xp);
        
        v_badges := v_state.badges;
        IF v_badges IS NULL THEN v_badges := '[]'::jsonb; END IF;
        
        IF p_badge IS NOT NULL THEN
            IF NOT (v_badges @> jsonb_build_array(jsonb_build_object('id', p_badge->>'id'))) THEN
                v_badges := v_badges || jsonb_build_array(p_badge);
            END IF;
        END IF;

        -- Check ANNIVERSARIO badge (se utente esiste da +1 anno)
        IF v_created_at < now() - interval '1 year' THEN
            IF NOT (v_badges @> '[{"id": "anni"}]'::jsonb) THEN
                v_badges := v_badges || '[{"id": "anni", "name": "Anniversario", "icon": "🎂", "description": "Sei con noi da un anno. Grazie per il tuo impegno costante!", "color": "bg-pink-50"}]'::jsonb;
            END IF;
        END IF;

        UPDATE gamification_state
        SET xp = v_new_xp,
            level = v_new_level,
            badges = v_badges,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- Sync to profiles
    UPDATE profiles SET impact_points = v_new_xp WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."award_gamification_xp"("p_user_id" "uuid", "p_xp_amount" integer, "p_badge" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_edge_function_url"("p_function_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_base_url text;
begin
  select value
    into v_base_url
  from public.runtime_settings
  where key = 'functions_base_url';

  if v_base_url is null or btrim(v_base_url) = '' then
    return null;
  end if;

  v_base_url := regexp_replace(v_base_url, '/+$', '');
  return v_base_url || '/' || trim(both '/' from coalesce(p_function_name, ''));
end;
$_$;


ALTER FUNCTION "public"."build_edge_function_url"("p_function_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_level_from_xp"("p_xp" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    IF p_xp < 110 THEN RETURN 1; END IF;
    IF p_xp < 450 THEN RETURN 2; END IF;
    IF p_xp < 1000 THEN RETURN 3; END IF;
    IF p_xp < 2000 THEN RETURN 4; END IF;
    IF p_xp < 3500 THEN RETURN 5; END IF;
    IF p_xp < 5500 THEN RETURN 6; END IF;
    IF p_xp < 8000 THEN RETURN 7; END IF;
    IF p_xp < 11000 THEN RETURN 8; END IF;
    IF p_xp < 15000 THEN RETURN 9; END IF;
    RETURN FLOOR(10 + (p_xp - 15000) / 5000.0);
END;
$$;


ALTER FUNCTION "public"."calculate_level_from_xp"("p_xp" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_check_activity_matches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  service_role_key text;
  v_url text;
begin
  service_role_key := current_setting('app.settings.service_role_key', true);
  v_url := public.build_edge_function_url('check-new-activity-matches');

  if service_role_key is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(new)),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."call_check_activity_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_generate_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  service_role_key text;
  v_url text;
begin
  service_role_key := current_setting('app.settings.service_role_key', true);
  v_url := public.build_edge_function_url('generate-embedding');

  if service_role_key is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'table', tg_table_name,
      'schema', tg_table_schema
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."call_generate_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_add_private_conversation_participant"("p_conversation_id" "uuid", "p_actor_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.type = 'PRIVATE'
      AND public.is_conversation_participant(p_conversation_id, p_actor_id)
  );
$$;


ALTER FUNCTION "public"."can_add_private_conversation_participant"("p_conversation_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_next_occurrence"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    next_start TIMESTAMPTZ;
    next_end TIMESTAMPTZ;
    duration INTERVAL;
BEGIN
    -- Only act when status changes TO COMPLETATA
    IF NEW.status = 'COMPLETATA' AND OLD.status <> 'COMPLETATA' THEN
        -- Only for recurring activities
        IF NEW.recurrence IS NOT NULL AND NEW.recurrence <> 'NONE' THEN
            -- Calculate duration of original activity
            duration := NEW.date_end - NEW.date_start;

            -- Calculate next start date based on recurrence type
            IF NEW.recurrence = 'WEEKLY' THEN
                next_start := NEW.date_start + INTERVAL '7 days';
            ELSIF NEW.recurrence = 'MONTHLY' THEN
                next_start := NEW.date_start + INTERVAL '1 month';
            END IF;

            next_end := next_start + duration;

            -- Check that no occurrence already exists for same npo + activity template (same title + npo) in future
            IF NOT EXISTS (
                SELECT 1 FROM activities
                WHERE npo_id = NEW.npo_id
                  AND title = NEW.title
                  AND date_start = next_start
            ) THEN
                INSERT INTO activities (
                    npo_id,
                    title,
                    description,
                    category,
                    date_start,
                    date_end,
                    location_address,
                    location_lat,
                    location_lng,
                    slots_total,
                    image_url,
                    status,
                    recurrence,
                    is_urgent
                ) VALUES (
                    NEW.npo_id,
                    NEW.title,
                    NEW.description,
                    NEW.category,
                    next_start,
                    next_end,
                    NEW.location_address,
                    NEW.location_lat,
                    NEW.location_lng,
                    NEW.slots_total,
                    NEW.image_url,
                    'APERTA',
                    NEW.recurrence,
                    NEW.is_urgent
                );

                -- Copy skills to the new activity
                INSERT INTO activity_skills (activity_id, skill)
                SELECT (SELECT id FROM activities WHERE npo_id = NEW.npo_id AND title = NEW.title AND date_start = next_start ORDER BY created_at DESC LIMIT 1), skill
                FROM activity_skills
                WHERE activity_id = NEW.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_next_occurrence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_activities_near_me"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision) RETURNS TABLE("id" "uuid", "npo_id" "uuid", "npo_name" "text", "title" "text", "description" "text", "category" "text", "location_address" "text", "location_lat" double precision, "location_lng" double precision, "image_url" "text", "is_urgent" boolean, "status" "text", "date_start" timestamp with time zone, "date_end" timestamp with time zone, "slots_total" integer, "match_percentage" integer, "distance_meters" double precision, "participants_count" integer, "skills_array" "text"[])
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_activities_near_me"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_activities_with_match"("p_user_id" "uuid", "p_category" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_center_lat" double precision DEFAULT NULL::double precision, "p_center_lng" double precision DEFAULT NULL::double precision, "p_radius_km" double precision DEFAULT 50, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_skills" "text"[] DEFAULT '{}'::"text"[], "p_only_urgent" boolean DEFAULT false, "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_statuses" "text"[] DEFAULT '{APERTA}'::"text"[]) RETURNS TABLE("id" "uuid", "npo_id" "uuid", "npo_name" "text", "title" "text", "description" "text", "category" "text", "location_address" "text", "location_lat" double precision, "location_lng" double precision, "image_url" "text", "is_urgent" boolean, "status" "text", "date_start" timestamp with time zone, "date_end" timestamp with time zone, "slots_total" integer, "match_percentage" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_embedding vector(384);
  v_user_interests text[];
  v_user_skills text[];
  v_has_profile_data boolean := false;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT embedding INTO v_user_embedding FROM public.profiles WHERE public.profiles.id = p_user_id;
    SELECT array_agg(public.normalize_activity_category(interest)) INTO v_user_interests FROM public.user_interests WHERE user_id = p_user_id;
    SELECT array_agg(public.normalize_skill_value(skill)) INTO v_user_skills FROM public.user_skills WHERE user_id = p_user_id;

    IF v_user_embedding IS NOT NULL OR v_user_interests IS NOT NULL OR v_user_skills IS NOT NULL THEN
      v_has_profile_data := true;
    END IF;
  END IF;

  v_user_interests := COALESCE(v_user_interests, '{}'::text[]);
  v_user_skills := COALESCE(v_user_skills, '{}'::text[]);

  RETURN QUERY
  WITH filtered_activities AS (
    SELECT
      a.*,
      COALESCE(p.npo_name, p.full_name) AS npo_computed_name,
      public.normalize_activity_category(a.category) AS normalized_category
    FROM public.activities a
    LEFT JOIN public.profiles p ON a.npo_id = p.id
    WHERE (p_category IS NULL OR p_category = 'Tutti' OR public.normalize_activity_category(a.category) = public.normalize_activity_category(p_category))
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
          WHERE s.activity_id = a.id
            AND public.normalize_skill_value(s.skill) = ANY(
              ARRAY(SELECT public.normalize_skill_value(skill_value) FROM unnest(p_skills) AS skill_list(skill_value))
            )
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
        WHERE s.activity_id = fa.id AND public.normalize_skill_value(s.skill) = ANY(v_user_skills)
      ) AS user_skills_match_count,
      CASE WHEN fa.normalized_category = ANY(v_user_interests) THEN 1 ELSE 0 END AS interest_match
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
          LEAST(30, (sa.user_skills_match_count * 10)) +
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
          CASE WHEN public.normalize_activity_category(sa.category) = public.normalize_activity_category(p_category) THEN 10 ELSE 0 END +
          CASE WHEN sa.is_urgent THEN 5 ELSE 0 END
      END
    ))::int AS match_percentage
  FROM scored_activities sa
  ORDER BY match_percentage DESC, sa.date_start ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_activities_with_match"("p_user_id" "uuid", "p_category" "text", "p_search" "text", "p_center_lat" double precision, "p_center_lng" double precision, "p_radius_km" double precision, "p_limit" integer, "p_offset" integer, "p_skills" "text"[], "p_only_urgent" boolean, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_statuses" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_inbox"("p_user_id" "uuid") RETURNS TABLE("conversation_id" "uuid", "conversation_type" "text", "activity_id" "uuid", "created_at" timestamp with time zone, "last_message_content" "text", "last_message_at" timestamp with time zone, "last_message_sender_id" "uuid", "inbox_visible_at" timestamp with time zone, "last_read_at" timestamp with time zone, "title" "text", "avatar_url" "text", "other_user_id" "uuid", "unread_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH user_rows AS (
    SELECT
      cp.conversation_id,
      cp.last_read_at,
      cp.inbox_visible_at
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user_id
      AND cp.hidden_at IS NULL
  )
  SELECT
    ur.conversation_id,
    c.type::text AS conversation_type,
    c.activity_id,
    c.created_at,
    c.last_message_content,
    c.last_message_at,
    c.last_message_sender_id,
    ur.inbox_visible_at,
    ur.last_read_at,
    CASE
      WHEN c.type = 'PRIVATE' THEN COALESCE(other_profile.npo_name, other_profile.full_name, 'Chat Diretta')
      ELSE COALESCE(a.title, 'Gruppo Attività')
    END AS title,
    CASE
      WHEN c.type = 'PRIVATE' THEN other_profile.avatar_url
      ELSE NULL
    END AS avatar_url,
    CASE
      WHEN c.type = 'PRIVATE' THEN other_part.user_id
      ELSE NULL
    END AS other_user_id,
    COALESCE(unread.unread_count, 0)::integer AS unread_count
  FROM user_rows ur
  JOIN public.conversations c
    ON c.id = ur.conversation_id
  LEFT JOIN public.activities a
    ON a.id = c.activity_id
  LEFT JOIN LATERAL (
    SELECT cp2.user_id
    FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = ur.conversation_id
      AND cp2.user_id <> p_user_id
    ORDER BY cp2.user_id
    LIMIT 1
  ) other_part ON c.type = 'PRIVATE'
  LEFT JOIN public.profiles other_profile
    ON other_profile.id = other_part.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM public.messages m
    WHERE m.conversation_id = ur.conversation_id
      AND m.sender_id <> p_user_id
      AND (ur.last_read_at IS NULL OR m.created_at > ur.last_read_at)
  ) unread ON TRUE
  WHERE (
    (c.last_message_at IS NOT NULL AND COALESCE(BTRIM(c.last_message_content), '') <> '')
    OR (c.type = 'PRIVATE' AND ur.inbox_visible_at IS NOT NULL)
  )
    AND (
      c.type <> 'PRIVATE'
      OR other_part.user_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.blocked_users bu
        WHERE (bu.blocker_id = p_user_id AND bu.blocked_id = other_part.user_id)
           OR (bu.blocker_id = other_part.user_id AND bu.blocked_id = p_user_id)
      )
    )
  ORDER BY COALESCE(c.last_message_at, ur.inbox_visible_at, c.created_at) DESC;
$$;


ALTER FUNCTION "public"."get_chat_inbox"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_matching_volunteers"("p_activity_id" "uuid") RETURNS TABLE("user_id" "uuid", "score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    (1 - (p.embedding <=> a.embedding))::numeric as score
  FROM public.profiles p
  CROSS JOIN public.activities a
  WHERE a.id = p_activity_id
  AND p.role = 'VOLUNTEER'
  AND p.embedding IS NOT NULL
  AND (1 - (p.embedding <=> a.embedding)) > 0.7
  ORDER BY score DESC;
END;
$$;


ALTER FUNCTION "public"."get_matching_volunteers"("p_activity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_blocked_users"() RETURNS TABLE("id" "uuid", "blocked_id" "uuid", "full_name" "text", "npo_name" "text", "avatar_url" "text", "role" "public"."user_role")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select
      bu.id,
      bu.blocked_id,
      p.full_name,
      p.npo_name,
      p.avatar_url,
      p.role
    from public.blocked_users bu
    join public.profiles p on p.id = bu.blocked_id
    where bu.blocker_id = auth.uid()
    order by p.full_name asc nulls last, p.npo_name asc nulls last;
  $$;


ALTER FUNCTION "public"."get_my_blocked_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_conversations"() RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_my_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_referral_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select count(*)::integer
    from public.profiles
    where referred_by = auth.uid();
  $$;


ALTER FUNCTION "public"."get_my_referral_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_report_count"("p_reported_id" "uuid", "p_days" integer DEFAULT 30) RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT count(*)::int
  FROM public.reports
  WHERE reported_id = p_reported_id
    AND status IN ('resolved', 'banned') -- Only confirmed reports
    AND created_at > now() - (p_days || ' days')::interval;
$$;


ALTER FUNCTION "public"."get_report_count"("p_reported_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rls_summary"() RETURNS TABLE("tablename" "text", "rls_enabled" boolean, "policyname" "text", "cmd" "text", "roles" "text"[], "using_expr" "text", "check_expr" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::text as tablename,
        t.relrowsecurity as rls_enabled,
        p.polname::text as policyname,
        CASE p.polcmd 
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
            ELSE p.polcmd::text
        END as cmd,
        p.polroles::text[] as roles,
        pg_get_expr(p.polqual, p.polrelid) as using_expr,
        pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = t.oid
    WHERE n.nspname = 'public' 
      AND t.relkind = 'r'
    ORDER BY t.relname, p.polname;
END;
$$;


ALTER FUNCTION "public"."get_rls_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_messages_count"("p_user_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    unread_count BIGINT;
BEGIN
    SELECT COALESCE(SUM(
        (SELECT COUNT(*) 
         FROM messages m 
         WHERE m.conversation_id = cp.conversation_id 
           AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::TIMESTAMP)
           AND m.sender_id != p_user_id)
    ), 0) INTO unread_count
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id;

    RETURN unread_count;
END;
$$;


ALTER FUNCTION "public"."get_unread_messages_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_activity_completion_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_participant record;
BEGIN
    IF NEW.status = 'COMPLETATA' THEN
        FOR v_participant IN 
            -- CHANGED: ONLY CHECKED_IN
            SELECT user_id FROM activity_participants 
            WHERE activity_id = NEW.id AND status = 'CHECKED_IN'
        LOOP
            PERFORM award_activity_completion_to_user(v_participant.user_id, NEW);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_activity_completion_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auto_chat_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (NEW.status = 'APPROVED' OR NEW.status = 'REGISTERED') THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT c.id, NEW.user_id 
    FROM public.conversations c
    WHERE c.activity_id = NEW.activity_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_auto_chat_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_checkin_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_activity record;
BEGIN
    -- If participant becomes CHECKED_IN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'CHECKED_IN') OR
       (TG_OP = 'INSERT' AND NEW.status = 'CHECKED_IN') THEN
        
        -- Get the activity
        SELECT * INTO v_activity FROM activities WHERE id = NEW.activity_id;
        
        -- If the activity is already completely finished (or if you want to reward right away even if IN_CORSO?)
        -- Since users usually get rewards when activity is done, let's keep it to COMPLETATA. 
        -- OR wait, if NPO checks them in while IN_CORSO, should they get rewards? Usually at completion.
        -- We can just reward them the moment they are checked in, regardless if the activity is officially completata or in corso yet, 
        -- but wait, duration_hours might confuse them. Actually, yes, let's give the reward if the activity is COMPLETATA or IN_CORSO.
        -- But since cron puts it to IN_CORSO then COMPLETATA, usually checkin happens right before or right after.
        -- Let's give it if activity is IN_CORSO or COMPLETATA.
        IF v_activity.status IN ('COMPLETATA', 'IN_CORSO') THEN
             PERFORM award_activity_completion_to_user(NEW.user_id, v_activity);
        END IF;

    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_checkin_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_gamification_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.gamification_state (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_gamification_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_referred_by_id UUID;
BEGIN
  -- Attempt to extract referred_by_id from metadata
  BEGIN
    v_referred_by_id := (NEW.raw_user_meta_data->>'referred_by_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_referred_by_id := NULL;
  END;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    avatar_url, 
    role, 
    npo_name, 
    company_name, 
    referred_by, 
    referral_code
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'displayName'), 
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'avatar'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'VOLUNTEER'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'npo_name', NEW.raw_user_meta_data->>'npoName'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', NEW.raw_user_meta_data->>'companyName'),
    v_referred_by_id,
    substring(NEW.id::text, 1, 8) -- Initial referral code (first 8 chars of UUID)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_participation_status_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only when becoming APPROVED
    IF (TG_OP = 'INSERT' AND NEW.status = 'APPROVED') OR 
       (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'APPROVED') THEN
        -- Instant reward for being selected
        PERFORM award_gamification_xp(NEW.user_id, 200, NULL);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_participation_status_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_conversation_for_user"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE public.conversation_participants
  SET hidden_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."hide_conversation_for_user"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_community_moderator_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('community-moderator-ai');

  if v_secret is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."invoke_community_moderator_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_process_notification_jobs"("p_limit" integer DEFAULT 100) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_url text;
  v_limit integer;
  v_request_id bigint;
begin
  select value
    into v_url
  from public.runtime_settings
  where key = 'process_notification_jobs_url';

  if v_url is null or btrim(v_url) = '' then
    raise notice 'runtime setting process_notification_jobs_url is not configured; skipping';
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 500);

  select net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('limit', v_limit)
  )
    into v_request_id;

  return v_request_id;
end;
$$;


ALTER FUNCTION "public"."invoke_process_notification_jobs"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_push_notification_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_url text;
begin
  v_url := public.build_edge_function_url('push-notifications');
  if v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := json_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', row_to_json(new)
    )::jsonb
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."invoke_push_notification_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    return exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'ADMIN'
    );
  end;
  $$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_banned"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    return coalesce((
      select is_banned
      from public.profiles
      where id = auth.uid()
    ), false);
  end;
  $$;


ALTER FUNCTION "public"."is_current_user_banned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_activities"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_lat" double precision DEFAULT NULL::double precision, "user_lng" double precision DEFAULT NULL::double precision) RETURNS TABLE("id" "uuid", "npo_id" "uuid", "npo_name" "text", "title" "text", "description" "text", "category" "text", "location_address" "text", "location_lat" double precision, "location_lng" double precision, "image_url" "text", "is_urgent" boolean, "status" "text", "date_start" timestamp with time zone, "date_end" timestamp with time zone, "similarity" double precision, "match_percentage" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  semantic_weight float := 0.75;
  proximity_weight float := 0.15;
  urgency_weight float := 0.10;
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.npo_id,
    p.npo_name,
    a.title,
    a.description,
    a.category,
    a.location_address,
    a.location_lat,
    a.location_lng,
    a.image_url,
    a.is_urgent,
    a.status::text,
    a.date_start,
    a.date_end,
    1 - (a.embedding <=> query_embedding) AS similarity,
    LEAST(100, (
      -- Semantic Score (75%)
      ((1 - (a.embedding <=> query_embedding)) * 75) +
      
      -- Proximity Score (15%)
      CASE 
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND a.location_lat IS NOT NULL AND a.location_lng IS NOT NULL THEN
          -- earth_distance returns meters. 5000m = 5km, 15000m = 15km, 50000m = 50km
          CASE 
            WHEN (earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(a.location_lat, a.location_lng))) < 5000 THEN 15
            WHEN (earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(a.location_lat, a.location_lng))) < 15000 THEN 10
            WHEN (earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(a.location_lat, a.location_lng))) < 50000 THEN 5
            ELSE 0
          END
        ELSE 0
      END +
      
      -- Urgency/Time (10%)
      CASE 
        WHEN a.is_urgent THEN 6 -- 6% for urgency
        ELSE 0
      END +
      CASE 
        WHEN a.date_start - now() < interval '2 days' THEN 4 -- 4% for imminent start
        WHEN a.date_start - now() < interval '7 days' THEN 2
        ELSE 0
      END
    ))::int AS match_percentage
  FROM public.activities a
  LEFT JOIN public.profiles p ON a.npo_id = p.id
  WHERE a.status = 'APERTA'
    AND 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY (1 - (a.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_activities"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_lat" double precision, "user_lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_activity_category"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE upper(trim(coalesce(input, '')))
    WHEN 'ISTRUZIONE' THEN 'EDUCAZIONE'
    WHEN 'EDUCATION' THEN 'EDUCAZIONE'
    WHEN 'ARTE' THEN 'ARTE & CULTURA'
    WHEN 'ARTE E CULTURA' THEN 'ARTE & CULTURA'
    ELSE upper(trim(coalesce(input, '')))
  END
$$;


ALTER FUNCTION "public"."normalize_activity_category"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_skill_value"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE upper(trim(coalesce(input, '')))
    WHEN 'ASSISTENZA' THEN 'assistenza'
    WHEN 'ASSISTENZA E COMPAGNIA' THEN 'assistenza'
    WHEN 'SANITARIO' THEN 'sanitario'
    WHEN 'SUPPORTO SANITARIO E SOCCORSO' THEN 'sanitario'
    WHEN 'EDUCAZIONE' THEN 'educazione'
    WHEN 'EDUCAZIONE E MENTORING' THEN 'educazione'
    WHEN 'LOGISTICA' THEN 'logistica'
    WHEN 'LOGISTICA E DISTRIBUZIONE' THEN 'logistica'
    WHEN 'AMBIENTE' THEN 'ambiente'
    WHEN 'MANUTENZIONE E AMBIENTE' THEN 'ambiente'
    WHEN 'CUCINA' THEN 'cucina'
    WHEN 'CUCINA E MENSA' THEN 'cucina'
    WHEN 'DIGITAL' THEN 'digital'
    WHEN 'DIGITAL & SOCIAL MEDIA' THEN 'digital'
    WHEN 'CREATIVITA' THEN 'creativita'
    WHEN 'CREATIVITÀ' THEN 'creativita'
    WHEN 'CREATIVITÀ E GRAFICA' THEN 'creativita'
    WHEN 'CREATIVITA E GRAFICA' THEN 'creativita'
    WHEN 'SCRITTURA' THEN 'scrittura'
    WHEN 'SCRITTURA E STORYTELLING' THEN 'scrittura'
    WHEN 'AMMINISTRAZIONE' THEN 'amministrazione'
    WHEN 'AMMINISTRAZIONE E GESTIONE' THEN 'amministrazione'
    WHEN 'TECNOLOGIA' THEN 'tecnologia'
    WHEN 'TECNOLOGIA E IT' THEN 'tecnologia'
    WHEN 'LINGUE' THEN 'lingue'
    WHEN 'LINGUE E TRADUZIONI' THEN 'lingue'
    WHEN 'ANIMALI' THEN 'animali'
    WHEN 'TUTELA ANIMALI' THEN 'animali'
    WHEN 'SPORT' THEN 'sport'
    WHEN 'SPORT PER IL SOCIALE' THEN 'sport'
    ELSE lower(trim(coalesce(input, '')))
  END
$$;


ALTER FUNCTION "public"."normalize_skill_value"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admin_on_report"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RAISE NOTICE 'New Community Report! Post ID: %, Reason: %', NEW.post_id, NEW.reason;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_admin_on_report"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_activity_change_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('generate-embedding');

  if v_secret is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'table', tg_table_name,
      'type', tg_op
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."on_activity_change_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_activity_skill_change_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.activities 
  SET embedding = NULL
  WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."on_activity_skill_change_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_interest_change_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.profiles 
  SET embedding = NULL,
      updated_at = now()
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."on_interest_change_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_notification_inserted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('notify-user');

  if v_secret is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public'
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."on_notification_inserted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_profile_change_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('generate-embedding');

  if v_secret is null or v_url is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'table', tg_table_name,
      'type', tg_op
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."on_profile_change_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_skill_change_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  profile_record record;
  v_secret text;
  v_url text;
begin
  select * into profile_record from public.profiles where id = coalesce(new.user_id, old.user_id);
  select value into v_secret from public.internal_secrets where key = 'service_role_key';
  v_url := public.build_edge_function_url('generate-embedding');

  if profile_record is not null and v_url is not null then
    perform net.http_post(
      url := v_url,
      headers := case
        when v_secret is null then jsonb_build_object('Content-Type', 'application/json')
        else jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_secret
        )
      end,
      body := jsonb_build_object(
        'table', 'profiles',
        'record', row_to_json(profile_record),
        'type', 'UPDATE'
      )
    );
  end if;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."on_skill_change_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_audit_log_modification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'La tabella admin_audit_logs è a sola aggiunta (Append-Only) per motivi di conformità.';
END;
$$;


ALTER FUNCTION "public"."prevent_audit_log_modification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_activity_share"("p_activity_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_state record;
    v_shared_count integer;
    v_badge jsonb := NULL;
BEGIN
    SELECT * INTO v_state FROM gamification_state WHERE user_id = auth.uid();
    
    IF v_state.shared_activity_ids @> ARRAY[p_activity_id]::uuid[] THEN
        RETURN; 
    END IF;

    v_shared_count := COALESCE(array_length(v_state.shared_activity_ids, 1), 0) + 1;
    
    IF v_shared_count = 10 THEN
        v_badge := '{"id": "voce", "name": "Voce del Popolo", "icon": "📢", "description": "Hai condiviso 10 attività. Grazie per il passaparola!", "color": "bg-yellow-100"}';
    END IF;

    UPDATE gamification_state 
    SET shared_activity_ids = array_append(shared_activity_ids, p_activity_id)
    WHERE user_id = auth.uid();

    PERFORM award_gamification_xp(auth.uid(), 10, v_badge);
END;
$$;


ALTER FUNCTION "public"."record_activity_share"("p_activity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_my_interests"("p_interests" "text"[] DEFAULT '{}'::"text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    delete from public.user_interests where user_id = auth.uid();

    insert into public.user_interests (user_id, interest)
    select auth.uid(), interest_value
    from unnest(coalesce(p_interests, '{}')) as interest_value
    where nullif(trim(interest_value), '') is not null;
  end;
  $$;


ALTER FUNCTION "public"."replace_my_interests"("p_interests" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_my_interests"("p_interests" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    delete from public.user_interests where user_id = auth.uid();

    insert into public.user_interests (user_id, interest)
    select auth.uid(), value
    from jsonb_array_elements_text(coalesce(p_interests, '[]'::jsonb)) as value
    where nullif(trim(value), '') is not null;
  end;
  $$;


ALTER FUNCTION "public"."replace_my_interests"("p_interests" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_my_skills"("p_skills" "text"[] DEFAULT '{}'::"text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    delete from public.user_skills where user_id = auth.uid();

    insert into public.user_skills (user_id, skill)
    select auth.uid(), skill_value
    from unnest(coalesce(p_skills, '{}')) as skill_value
    where nullif(trim(skill_value), '') is not null;
  end;
  $$;


ALTER FUNCTION "public"."replace_my_skills"("p_skills" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_my_skills"("p_skills" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    delete from public.user_skills where user_id = auth.uid();

    insert into public.user_skills (user_id, skill)
    select auth.uid(), value
    from jsonb_array_elements_text(coalesce(p_skills, '[]'::jsonb)) as value
    where nullif(trim(value), '') is not null;
  end;
  $$;


ALTER FUNCTION "public"."replace_my_skills"("p_skills" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_chat_message"("p_conversation_id" "uuid", "p_sender_id" "uuid", "p_content" "text", "p_metadata" json DEFAULT '{}'::json) RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "sender_id" "uuid", "content" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.messages%ROWTYPE;
BEGIN
  IF p_sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blocked_users bu
    JOIN public.conversation_participants cp
      ON cp.conversation_id = p_conversation_id
     AND cp.user_id <> p_sender_id
    WHERE bu.blocker_id = cp.user_id
      AND bu.blocked_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  UPDATE public.conversation_participants AS cp
  SET
    hidden_at = NULL,
    inbox_visible_at = COALESCE(cp.inbox_visible_at, now())
  WHERE cp.conversation_id = p_conversation_id;

  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    metadata
  )
  VALUES (
    p_conversation_id,
    p_sender_id,
    p_content,
    COALESCE(p_metadata, '{}'::json)
  )
  RETURNING * INTO v_row;

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.conversation_id,
    v_row.sender_id,
    v_row.content,
    v_row.metadata,
    v_row.created_at;
END;
$$;


ALTER FUNCTION "public"."send_chat_message"("p_conversation_id" "uuid", "p_sender_id" "uuid", "p_content" "text", "p_metadata" json) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_notification_jobs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_notification_jobs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_notification_rate_limits_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_notification_rate_limits_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_runtime_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_runtime_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_private_conversation_between"("p_user_id_1" "uuid", "p_user_id_2" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id uuid;
  v_now timestamptz := now();
  v_private_key text;
BEGIN
  v_private_key := (
    SELECT string_agg(user_id::text, ':' ORDER BY user_id::text)
    FROM (VALUES (p_user_id_1), (p_user_id_2)) AS users(user_id)
  );

  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE c.type = 'PRIVATE'
    AND c.activity_id IS NULL
    AND c.private_key = v_private_key
  ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations(type, private_key)
    VALUES ('PRIVATE', v_private_key)
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.conversation_participants(conversation_id, user_id, inbox_visible_at, hidden_at)
  VALUES
    (v_conversation_id, p_user_id_1, v_now, NULL),
    (v_conversation_id, p_user_id_2, v_now, NULL)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    inbox_visible_at = EXCLUDED.inbox_visible_at,
    hidden_at = NULL;

  UPDATE public.conversations c
  SET
    last_message_content = NULL,
    last_message_at = NULL,
    last_message_sender_id = NULL
  WHERE c.id = v_conversation_id
    AND c.type = 'PRIVATE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = c.id
    )
    AND COALESCE(BTRIM(c.last_message_content), '') IN ('', 'Nuova conversazione');

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."start_private_conversation_between"("p_user_id_1" "uuid", "p_user_id_2" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_gamification_to_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_catalog'
    AS $$
BEGIN
    UPDATE public.profiles
    SET 
        impact_points = NEW.xp,
        badges = NEW.badges
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_gamification_to_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_gamification_xp_to_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_catalog'
    AS $$
BEGIN
    UPDATE public.profiles
    SET impact_points = NEW.xp
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_gamification_xp_to_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_group_conversation_participants"("p_conversation_id" "uuid", "p_activity_id" "uuid", "p_initiator_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_participant_ids UUID[];
BEGIN
    -- Collect all approved or registered participants
    SELECT array_agg(user_id) INTO v_participant_ids
    FROM public.activity_participants
    WHERE activity_id = p_activity_id AND status IN ('APPROVED', 'REGISTERED');

    -- Insert initiator if not present (often the NPO)
    IF p_initiator_id IS NOT NULL THEN
        IF v_participant_ids IS NULL THEN
            v_participant_ids := ARRAY[p_initiator_id];
        ELSIF NOT(v_participant_ids @> ARRAY[p_initiator_id]) THEN
            v_participant_ids := array_append(v_participant_ids, p_initiator_id);
        END IF;
    END IF;

    -- Upsert all participants into conversation_participants safely
    IF array_length(v_participant_ids, 1) > 0 THEN
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        SELECT p_conversation_id, unnest(v_participant_ids)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "public"."sync_group_conversation_participants"("p_conversation_id" "uuid", "p_activity_id" "uuid", "p_initiator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_location_coords"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_catalog'
    AS $$
BEGIN
    IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL
       AND (NEW.location_lat <> 0 OR NEW.location_lng <> 0) THEN
        NEW.location_coords = ST_SetSRID(
            ST_MakePoint(NEW.location_lng, NEW.location_lat),
            4326
        )::geography(POINT, 4326);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_location_coords"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_application_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_activity record;
    v_duration_hours float;
    v_xp integer := 100;
    v_state gamification_state%ROWTYPE;
    v_new_count integer;
    v_bonus_xp integer := 0;
    v_new_hours float;
    
    v_categories_count integer;
    v_weeks_count integer;
    v_awarded_badges jsonb[] := '{}';
BEGIN
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;

    -- CANDIDATURA ACCETTATA
    IF NEW.status = 'ACCETTATA' THEN
        PERFORM award_gamification_xp(NEW.volunteer_id, 200, NULL);
    END IF;

    -- ATTIVITÀ COMPLETATA
    IF NEW.status = 'COMPLETATA' THEN
        SELECT * INTO v_activity FROM activities WHERE id = NEW.activity_id;
        v_duration_hours := EXTRACT(EPOCH FROM (v_activity.end_date_time - v_activity.date_time)) / 3600.0;
        
        IF v_duration_hours > 6 THEN v_xp := 200;
        ELSIF v_duration_hours > 3 THEN v_xp := 150;
        END IF;

        SELECT * INTO v_state FROM gamification_state WHERE user_id = NEW.volunteer_id;
        v_new_count := COALESCE(v_state.completed_activities_count, 0) + 1;
        v_new_hours := COALESCE(v_state.total_hours, 0) + v_duration_hours;

        -- 1. Debuttante
        IF v_new_count = 1 THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "debt", "name": "Debuttante", "icon": "🌱", "description": "Hai completato la tua prima attività!", "color": "bg-green-100"}'::jsonb);
        END IF;

        -- 2. Pilastro
        IF v_new_count = 10 THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "pila", "name": "Pilastro", "icon": "🏛️", "description": "Hai completato 10 attività. Solido come una roccia.", "color": "bg-blue-100"}'::jsonb);
        END IF;

        -- 3. Stacanovista
        IF v_duration_hours > 6 THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "stac", "name": "Stacanovista", "icon": "🏎️", "description": "Hai partecipato a una maratona di volontariato (>6h). Wow!", "color": "bg-red-100"}'::jsonb);
        END IF;

        -- 4. Veterano
        IF v_new_hours >= 100 AND (v_state.badges IS NULL OR NOT (v_state.badges @> '[{"id": "vete"}]'::jsonb)) THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "vete", "name": "Veterano", "icon": "🏅", "description": "Hai superato le 100 ore di volontariato. Un vero leader.", "color": "bg-yellow-100"}'::jsonb);
            v_bonus_xp := v_bonus_xp + 1000;
        END IF;

        -- 5. Tuttofare: attività in 3 categorie differenti
        SELECT count(distinct a.category) INTO v_categories_count
        FROM applications ap JOIN activities a ON ap.activity_id = a.id
        WHERE ap.volunteer_id = NEW.volunteer_id AND ap.status = 'COMPLETATA';
        
        IF v_categories_count >= 3 AND (v_state.badges IS NULL OR NOT (v_state.badges @> '[{"id": "tutt"}]'::jsonb)) THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "tutt", "name": "Tuttofare", "icon": "🔧", "description": "Hai partecipato ad attività in 3 categorie diverse. Super versatile!", "color": "bg-orange-50"}'::jsonb);
        END IF;

        -- 6. Fedelissimo: attività in 4 settimane differenti dell'anno
        SELECT count(distinct to_char(a.end_date_time, 'IYYY-IW')) INTO v_weeks_count
        FROM applications ap JOIN activities a ON ap.activity_id = a.id
        WHERE ap.volunteer_id = NEW.volunteer_id AND ap.status = 'COMPLETATA';

        IF v_weeks_count >= 4 AND (v_state.badges IS NULL OR NOT (v_state.badges @> '[{"id": "fede"}]'::jsonb)) THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "fede", "name": "Fedelissimo", "icon": "💎", "description": "Hai partecipato ad eventi per 4 settimane. Costanza ammirevole!", "color": "bg-cyan-50"}'::jsonb);
        END IF;

        -- 7. Gufo Notturno: Inizia tra le 20:00 e le 07:00
        IF (EXTRACT(HOUR FROM v_activity.date_time) >= 20 OR EXTRACT(HOUR FROM v_activity.date_time) <= 7) 
           AND (v_state.badges IS NULL OR NOT (v_state.badges @> '[{"id": "gufo"}]'::jsonb)) THEN
            v_awarded_badges := array_append(v_awarded_badges, '{"id": "gufo", "name": "Gufo Notturno", "icon": "🦉", "description": "Hai partecipato ad un''attività notturna.", "color": "bg-indigo-50"}'::jsonb);
        END IF;

        -- Add bonus XP every 10 activities completed
        IF v_new_count > 0 AND v_new_count % 10 = 0 THEN
            v_bonus_xp := v_bonus_xp + 1000;
        END IF;

        -- Aggiorna contatori base
        UPDATE gamification_state
        SET completed_activities_count = v_new_count,
            total_hours = v_new_hours,
            processed_activity_ids = array_append(processed_activity_ids, NEW.activity_id::text)
        WHERE user_id = NEW.volunteer_id;
        
        -- Assegna Badge Sequenzialmente
        IF array_length(v_awarded_badges, 1) > 0 THEN
            FOR i IN 1..array_length(v_awarded_badges, 1) LOOP
                -- Diamo XP solo alla prima assegnazione per evitare duplicazione del bonus
                IF i = 1 THEN
                    PERFORM award_gamification_xp(NEW.volunteer_id, v_xp + v_bonus_xp, v_awarded_badges[i]);
                ELSE
                    PERFORM award_gamification_xp(NEW.volunteer_id, 0, v_awarded_badges[i]);
                END IF;
            END LOOP;
        ELSE
            PERFORM award_gamification_xp(NEW.volunteer_id, v_xp + v_bonus_xp, NULL);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_application_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_follow_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count integer;
    v_badge jsonb := NULL;
BEGIN
    SELECT COUNT(*) INTO v_count FROM npo_followers WHERE follower_id = NEW.follower_id;
    IF v_count = 5 THEN
        v_badge := '{"id": "netw", "name": "Networker", "icon": "🤝", "description": "Segui 5 NPO", "color": "bg-purple-100"}';
    END IF;
    PERFORM award_gamification_xp(NEW.follower_id, 10, v_badge);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_follow_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_review_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count integer;
    v_badge jsonb := NULL;
    v_xp integer := 0;
BEGIN
    SELECT COUNT(*) INTO v_count FROM reviews WHERE volunteer_id = NEW.volunteer_id;
    IF v_count = 5 THEN
        v_badge := '{"id": "rece", "name": "Recensore d''Oro", "icon": "🌟", "description": "Hai lasciato 5 recensioni costruttive. La tua opinione conta!", "color": "bg-yellow-50"}';
        v_xp := 150;
    END IF;
    IF v_badge IS NOT NULL THEN
        PERFORM award_gamification_xp(NEW.volunteer_id, v_xp, v_badge);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_review_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_consume_notification_rate_limit"("p_scope_key" "text", "p_job_type" "text", "p_window_seconds" integer, "p_now" timestamp with time zone DEFAULT "now"(), "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_last_sent_at timestamptz;
begin
  loop
    select last_sent_at
      into v_last_sent_at
    from public.notification_rate_limits
    where scope_key = p_scope_key
    for update;

    if not found then
      begin
        insert into public.notification_rate_limits (
          scope_key,
          job_type,
          window_seconds,
          last_sent_at,
          metadata
        ) values (
          p_scope_key,
          p_job_type,
          p_window_seconds,
          p_now,
          coalesce(p_metadata, '{}'::jsonb)
        );
        return true;
      exception
        when unique_violation then
      end;
    elsif v_last_sent_at + make_interval(secs => p_window_seconds) > p_now then
      return false;
    else
      update public.notification_rate_limits
         set job_type = p_job_type,
             window_seconds = p_window_seconds,
             last_sent_at = p_now,
             metadata = coalesce(p_metadata, '{}'::jsonb)
       where scope_key = p_scope_key;
      return true;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."try_consume_notification_rate_limit"("p_scope_key" "text", "p_job_type" "text", "p_window_seconds" integer, "p_now" timestamp with time zone, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_activity_statuses"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- 1. Passa le attività in IN_CORSO se l'ora di inizio è passata ma non quella di fine
  UPDATE public.activities
  SET status = 'IN_CORSO'
  WHERE status = 'APERTA' 
  AND date_start <= now() 
  AND (date_end IS NULL OR date_end > now());

  -- 2. Passa le attività in COMPLETATA se l'ora di fine è passata
  UPDATE public.activities
  SET status = 'COMPLETATA'
  WHERE status IN ('APERTA', 'IN_CORSO') 
  AND date_end <= now();
end;
$$;


ALTER FUNCTION "public"."update_activity_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_last_content TEXT;
  v_new_last_at      TIMESTAMPTZ;
  v_new_last_sender  UUID;
  v_conv_id          UUID;
BEGIN
  -- Determine which conversation to update
  IF TG_OP = 'DELETE' THEN
    v_conv_id := OLD.conversation_id;
  ELSE
    v_conv_id := NEW.conversation_id;
  END IF;

  -- For INSERT: just use the new message
  IF TG_OP = 'INSERT' THEN
    UPDATE public.conversations
    SET
      last_message_content    = NEW.content,
      last_message_at         = NEW.created_at,
      last_message_sender_id  = NEW.sender_id
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  END IF;

  -- For DELETE: recalculate from the remaining messages
  IF TG_OP = 'DELETE' THEN
    SELECT content, created_at, sender_id
    INTO v_new_last_content, v_new_last_at, v_new_last_sender
    FROM public.messages
    WHERE conversation_id = OLD.conversation_id
    ORDER BY created_at DESC
    LIMIT 1;

    UPDATE public.conversations
    SET
      last_message_content    = v_new_last_content,   -- NULL if no messages left
      last_message_at         = v_new_last_at,
      last_message_sender_id  = v_new_last_sender
    WHERE id = OLD.conversation_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expired_activities"() RETURNS TABLE("updated_id" "uuid", "activity_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE activities 
  SET status = 'IN_CORSO' 
  WHERE status = 'APERTA' 
    AND date_start <= now() 
    AND date_end > now();

  RETURN QUERY
  UPDATE activities
  SET status = 'COMPLETATA'
  WHERE status IN ('APERTA', 'IN_CORSO') 
    AND date_end <= now()
  RETURNING id, title;
END;
$$;


ALTER FUNCTION "public"."update_expired_activities"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile_core"("p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
      impact_points = case when p_payload ? 'impact_points' then (p_payload->>'impact_points')::integer else impact_points end,
      is_verified = case when p_payload ? 'is_verified' then (p_payload->>'is_verified')::boolean else is_verified end,
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
      sought_skills = case when p_payload ? 'sought_skills' then p_payload->'sought_skills' else sought_skills end,
      verification_doc_url = case when p_payload ? 'verification_doc_url' then nullif(trim(p_payload->>'verification_doc_url'), '') else verification_doc_url end,
      verification_status = case when p_payload ? 'verification_status' then p_payload->>'verification_status' else verification_status end,
      updated_at = now()
    where id = auth.uid();
  end;
  $$;


ALTER FUNCTION "public"."update_my_profile_core"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean DEFAULT NULL::boolean, "p_profile_public" boolean DEFAULT NULL::boolean, "p_show_email" boolean DEFAULT NULL::boolean, "p_show_volunteering_history" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    update public.profiles
    set
      allow_calls = coalesce(p_allow_calls, allow_calls),
      profile_public = coalesce(p_profile_public, profile_public),
      show_email = coalesce(p_show_email, show_email),
      show_volunteering_history = coalesce(p_show_volunteering_history, show_volunteering_history),
      updated_at = now()
    where id = auth.uid();
  end;
  $$;


ALTER FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean DEFAULT NULL::boolean, "p_profile_public" boolean DEFAULT NULL::boolean, "p_show_email" boolean DEFAULT NULL::boolean, "p_show_volunteering_history" boolean DEFAULT NULL::boolean, "p_volunteer_list_visible" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    update public.profiles
    set
      allow_calls = coalesce(p_allow_calls, allow_calls),
      profile_public = coalesce(p_profile_public, profile_public),
      show_email = coalesce(p_show_email, show_email),
      show_volunteering_history = coalesce(p_show_volunteering_history, show_volunteering_history),
      volunteer_list_visible = coalesce(p_volunteer_list_visible, volunteer_list_visible),
      updated_at = now()
    where id = auth.uid();
  end;
  $$;


ALTER FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean, "p_volunteer_list_visible" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_participants" (
    "activity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."participation_status" DEFAULT 'REGISTERED'::"public"."participation_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message" "text",
    "phone" "text"
);


ALTER TABLE "public"."activity_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid",
    "skill" "text" NOT NULL
);


ALTER TABLE "public"."activity_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "target_id" "uuid",
    "action_type" "text" NOT NULL,
    "reason" "text",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."app_spatial_ref_sys" WITH ("security_invoker"='true') AS
 SELECT "srid",
    "auth_name",
    "auth_srid",
    "proj4text"
   FROM "public"."spatial_ref_sys"
  WHERE ("srid" = ANY (ARRAY[3857, 4326]));


ALTER VIEW "public"."app_spatial_ref_sys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "npo_id" "uuid",
    "volunteer_id" "uuid",
    "status" "public"."application_status" DEFAULT 'PENDING'::"public"."application_status",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "blocked_users_check" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "caption" "text",
    "image_url" "text",
    "linked_activity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "images_urls" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    CONSTRAINT "community_posts_status_check" CHECK (("status" = ANY (ARRAY['published'::"text", 'pending'::"text", 'needs_review'::"text", 'shadow_banned'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."community_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "reported_user_id" "uuid",
    CONSTRAINT "community_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."community_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "notifications_muted" boolean DEFAULT false,
    "inbox_visible_at" timestamp with time zone,
    "hidden_at" timestamp with time zone
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."conversation_type" NOT NULL,
    "activity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "last_message_content" "text",
    "last_message_sender_id" "uuid",
    "private_key" "text"
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "faq_id" "text" NOT NULL,
    "section_id" "text" NOT NULL,
    "faq_question" "text",
    "vote" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "faq_feedback_vote_check" CHECK (("vote" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."faq_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gamification_state" (
    "user_id" "uuid" NOT NULL,
    "xp" integer DEFAULT 0,
    "level" integer DEFAULT 1,
    "badges" "jsonb" DEFAULT '[]'::"jsonb",
    "completed_activities_count" integer DEFAULT 0,
    "processed_activity_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "shared_activity_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "enrolled_npo_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "claimed_milestones" integer[] DEFAULT '{}'::integer[],
    "followed_npos_history" "uuid"[] DEFAULT '{}'::"uuid"[],
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_categories" "text"[] DEFAULT '{}'::"text"[],
    "total_hours" double precision DEFAULT 0,
    "completion_dates" "text"[] DEFAULT '{}'::"text"[],
    "reviewed_npo_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."gamification_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_secrets" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."internal_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."levels" (
    "id" integer NOT NULL,
    "min_xp" integer NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "related_activity_id" "uuid",
    "related_conversation_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dedupe_key" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."notification_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid",
    "status" "text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_rate_limits" (
    "scope_key" "text" NOT NULL,
    "job_type" "text" NOT NULL,
    "window_seconds" integer NOT NULL,
    "last_sent_at" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "related_activity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "match_score" numeric,
    "related_conversation_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."npo_followers" (
    "npo_id" "uuid" NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."npo_followers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "post_reactions_reaction_check" CHECK (("reaction" = ANY (ARRAY['heart'::"text", 'clap'::"text", 'muscle'::"text", 'tree'::"text"])))
);


ALTER TABLE "public"."post_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'VOLUNTEER'::"public"."user_role" NOT NULL,
    "full_name" "text",
    "email" "text",
    "avatar_url" "text",
    "bio" "text",
    "impact_points" integer DEFAULT 0,
    "location_string" "text",
    "location_lat" double precision,
    "location_lng" double precision,
    "is_verified" boolean DEFAULT false,
    "profile_completed" boolean DEFAULT false,
    "npo_name" "text",
    "phone" "text",
    "website" "text",
    "public_email" "text",
    "company_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "location_coords" "public"."geography"(Point,4326),
    "expo_push_token" "text",
    "embedding" "public"."vector"(384),
    "allow_calls" boolean DEFAULT true,
    "profile_public" boolean DEFAULT true,
    "show_email" boolean DEFAULT false,
    "volunteer_list_visible" boolean DEFAULT true,
    "show_volunteering_history" boolean DEFAULT true,
    "badges" "jsonb" DEFAULT '[]'::"jsonb",
    "deletion_requested_at" timestamp with time zone,
    "is_banned" boolean DEFAULT false,
    "ban_reason" "text",
    "ban_report_id" "uuid",
    "npo_vat_id" "text",
    "npo_website" "text",
    "referent_name" "text",
    "referent_role" "text",
    "referent_avatar_url" "text",
    "auto_welcome_message" "text",
    "address_full" "text",
    "sought_skills" "text"[] DEFAULT '{}'::"text"[],
    "verification_doc_url" "text",
    "location" "public"."geography"(Point,4326),
    "verification_status" "text" DEFAULT 'none'::"text",
    "referral_code" "text",
    "referred_by" "uuid",
    "gender" "text",
    "date_of_birth" "date",
    CONSTRAINT "profiles_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['FEMALE'::"text", 'MALE'::"text", 'OTHER'::"text", 'PREFER_NOT_TO_SAY'::"text"])))),
    CONSTRAINT "profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."is_verified" IS 'Stato di verifica dellente (Bollino Blu)';



COMMENT ON COLUMN "public"."profiles"."ban_report_id" IS 'ID of the report that caused the user to be banned';



COMMENT ON COLUMN "public"."profiles"."npo_vat_id" IS 'Partita IVA o Codice Fiscale dellente';



COMMENT ON COLUMN "public"."profiles"."sought_skills" IS 'Skill ricercate frequentemente dallorganizzazione per i match';



CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reporter_id" "uuid",
    "reported_id" "uuid",
    "content_type" "text" NOT NULL,
    "content_id" "uuid",
    "reason" "text" NOT NULL,
    "evidence_snapshot" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "admin_notes" "text",
    "admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolution_date" timestamp with time zone,
    "is_ai_generated" boolean DEFAULT false
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "npo_id" "uuid" NOT NULL,
    "volunteer_id" "uuid" NOT NULL,
    "stars" integer,
    "feelings" "text"[] DEFAULT '{}'::"text"[],
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."runtime_settings" (
    "key" "text" NOT NULL,
    "value" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."runtime_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "linked_activity_id" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unread_message_counts" WITH ("security_invoker"='true') AS
 SELECT "cp"."user_id",
    "cp"."conversation_id",
    "count"("m"."id") AS "unread_count"
   FROM ("public"."conversation_participants" "cp"
     JOIN "public"."messages" "m" ON (("cp"."conversation_id" = "m"."conversation_id")))
  WHERE (("m"."created_at" > "cp"."last_read_at") AND ("m"."sender_id" <> "cp"."user_id"))
  GROUP BY "cp"."user_id", "cp"."conversation_id";


ALTER VIEW "public"."unread_message_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "interest" "text" NOT NULL
);


ALTER TABLE "public"."user_interests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "skill" "text" NOT NULL
);


ALTER TABLE "public"."user_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "npo_details" "jsonb" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "verification_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."verification_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."volunteer_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "npo_id" "uuid" NOT NULL,
    "volunteer_id" "uuid" NOT NULL,
    "is_present" boolean DEFAULT true NOT NULL,
    "stars" integer,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "volunteer_reviews_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."volunteer_reviews" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("activity_id", "user_id");



ALTER TABLE ONLY "public"."activity_skills"
    ADD CONSTRAINT "activity_skills_activity_id_skill_key" UNIQUE ("activity_id", "skill");



ALTER TABLE ONLY "public"."activity_skills"
    ADD CONSTRAINT "activity_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_feedback"
    ADD CONSTRAINT "faq_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gamification_state"
    ADD CONSTRAINT "gamification_state_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."internal_secrets"
    ADD CONSTRAINT "internal_secrets_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_dedupe_key_unique" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_rate_limits"
    ADD CONSTRAINT "notification_rate_limits_pkey" PRIMARY KEY ("scope_key");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."npo_followers"
    ADD CONSTRAINT "npo_followers_pkey" PRIMARY KEY ("npo_id", "follower_id");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_user_id_reaction_key" UNIQUE ("post_id", "user_id", "reaction");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_activity_id_volunteer_id_key" UNIQUE ("activity_id", "volunteer_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."runtime_settings"
    ADD CONSTRAINT "runtime_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_user_id_interest_key" UNIQUE ("user_id", "interest");



ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_user_id_skill_key" UNIQUE ("user_id", "skill");



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_reviews"
    ADD CONSTRAINT "volunteer_reviews_activity_id_npo_id_volunteer_id_key" UNIQUE ("activity_id", "npo_id", "volunteer_id");



ALTER TABLE ONLY "public"."volunteer_reviews"
    ADD CONSTRAINT "volunteer_reviews_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "conversations_unique_activity_group_idx" ON "public"."conversations" USING "btree" ("activity_id") WHERE (("type" = 'ACTIVITY_GROUP'::"public"."conversation_type") AND ("activity_id" IS NOT NULL));



CREATE UNIQUE INDEX "conversations_unique_private_key_idx" ON "public"."conversations" USING "btree" ("private_key") WHERE (("type" = 'PRIVATE'::"public"."conversation_type") AND ("activity_id" IS NULL) AND ("private_key" IS NOT NULL));



CREATE INDEX "idx_activities_category" ON "public"."activities" USING "btree" ("category");



CREATE INDEX "idx_activities_created_at" ON "public"."activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activities_description_trgm" ON "public"."activities" USING "gin" ("description" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_activities_is_urgent" ON "public"."activities" USING "btree" ("is_urgent");



CREATE INDEX "idx_activities_location_coords" ON "public"."activities" USING "gist" ("location_coords");



CREATE INDEX "idx_activities_status" ON "public"."activities" USING "btree" ("status");



CREATE INDEX "idx_activities_title_trgm" ON "public"."activities" USING "gin" ("title" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_blocked_users_blocked" ON "public"."blocked_users" USING "btree" ("blocked_id");



CREATE INDEX "idx_blocked_users_blocked_id" ON "public"."blocked_users" USING "btree" ("blocked_id");



CREATE INDEX "idx_blocked_users_blocker" ON "public"."blocked_users" USING "btree" ("blocker_id");



CREATE INDEX "idx_blocked_users_blocker_id" ON "public"."blocked_users" USING "btree" ("blocker_id");



CREATE INDEX "idx_community_posts_created" ON "public"."community_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_posts_status" ON "public"."community_posts" USING "btree" ("status");



CREATE INDEX "idx_conv_participants_conv_user" ON "public"."conversation_participants" USING "btree" ("conversation_id", "user_id");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_faq_feedback_faq_id" ON "public"."faq_feedback" USING "btree" ("faq_id");



CREATE INDEX "idx_faq_feedback_vote" ON "public"."faq_feedback" USING "btree" ("vote");



CREATE INDEX "idx_notification_jobs_status_scheduled_for" ON "public"."notification_jobs" USING "btree" ("status", "scheduled_for");



CREATE INDEX "idx_notification_jobs_user_id" ON "public"."notification_jobs" USING "btree" ("user_id");



CREATE INDEX "idx_notification_rate_limits_job_type" ON "public"."notification_rate_limits" USING "btree" ("job_type");



CREATE INDEX "idx_post_reactions_post" ON "public"."post_reactions" USING "btree" ("post_id");



CREATE INDEX "idx_profiles_expo_push_token" ON "public"."profiles" USING "btree" ("expo_push_token") WHERE ("expo_push_token" IS NOT NULL);



CREATE INDEX "idx_profiles_last_seen" ON "public"."profiles" USING "btree" ("last_seen_at");



CREATE INDEX "idx_profiles_location_coords" ON "public"."profiles" USING "gist" ("location_coords");



CREATE INDEX "idx_profiles_referred_by" ON "public"."profiles" USING "btree" ("referred_by");



CREATE INDEX "idx_stories_author" ON "public"."stories" USING "btree" ("author_id");



CREATE INDEX "idx_stories_expires" ON "public"."stories" USING "btree" ("expires_at");



CREATE INDEX "idx_user_interests_user_id" ON "public"."user_interests" USING "btree" ("user_id");



CREATE INDEX "idx_user_skills_user_id" ON "public"."user_skills" USING "btree" ("user_id");



CREATE INDEX "reports_reported_id_idx" ON "public"."reports" USING "btree" ("reported_id");



CREATE INDEX "reports_status_idx" ON "public"."reports" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "moderation-webhook" AFTER INSERT ON "public"."community_posts" FOR EACH ROW EXECUTE FUNCTION "public"."invoke_community_moderator_webhook"();



CREATE OR REPLACE TRIGGER "on_checkin_gamification" AFTER INSERT OR UPDATE ON "public"."activity_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_checkin_gamification"();



CREATE OR REPLACE TRIGGER "on_npo_follow" AFTER INSERT ON "public"."npo_followers" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_follow_gamification"();



CREATE OR REPLACE TRIGGER "on_profile_created_gamification" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_gamification_state"();



CREATE OR REPLACE TRIGGER "on_volunteer_review" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_review_gamification"();



CREATE OR REPLACE TRIGGER "send_push_notification_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."invoke_push_notification_webhook"();



CREATE OR REPLACE TRIGGER "tr_on_activity_inserted_matches" AFTER INSERT ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."call_check_activity_matches"();



CREATE OR REPLACE TRIGGER "tr_on_activity_inserted_or_desc_updated" AFTER INSERT OR UPDATE OF "description" ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."call_generate_embedding"();



CREATE OR REPLACE TRIGGER "tr_on_notification_inserted" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."on_notification_inserted"();



CREATE OR REPLACE TRIGGER "tr_on_profile_bio_updated" AFTER INSERT OR UPDATE OF "bio" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."call_generate_embedding"();



CREATE OR REPLACE TRIGGER "tr_prevent_delete_audit_logs" BEFORE DELETE ON "public"."admin_audit_logs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."prevent_audit_log_modification"();



CREATE OR REPLACE TRIGGER "tr_prevent_update_audit_logs" BEFORE UPDATE ON "public"."admin_audit_logs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."prevent_audit_log_modification"();



CREATE OR REPLACE TRIGGER "tr_update_conversation_last_message" AFTER INSERT OR DELETE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_last_message"();



CREATE OR REPLACE TRIGGER "trg_activity_completion_gamification" AFTER UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."handle_activity_completion_gamification"();



CREATE OR REPLACE TRIGGER "trg_auto_sync_chat_on_participation" AFTER INSERT OR UPDATE OF "status" ON "public"."activity_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_auto_chat_sync"();



CREATE OR REPLACE TRIGGER "trg_create_next_occurrence" AFTER UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."create_next_occurrence"();



CREATE OR REPLACE TRIGGER "trg_notification_jobs_updated_at" BEFORE UPDATE ON "public"."notification_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_notification_jobs_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notification_rate_limits_updated_at" BEFORE UPDATE ON "public"."notification_rate_limits" FOR EACH ROW EXECUTE FUNCTION "public"."set_notification_rate_limits_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notify_admin_on_report" AFTER INSERT ON "public"."community_reports" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admin_on_report"();



CREATE OR REPLACE TRIGGER "trg_participation_status_gamification" AFTER INSERT OR UPDATE ON "public"."activity_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_participation_status_gamification"();



CREATE OR REPLACE TRIGGER "trg_runtime_settings_updated_at" BEFORE UPDATE ON "public"."runtime_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_runtime_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_gamification_to_profile" AFTER INSERT OR UPDATE ON "public"."gamification_state" FOR EACH ROW EXECUTE FUNCTION "public"."sync_gamification_to_profile"();



CREATE OR REPLACE TRIGGER "trg_sync_location_coords" BEFORE INSERT OR UPDATE OF "location_lat", "location_lng" ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."sync_location_coords"();



CREATE OR REPLACE TRIGGER "trigger_update_activity_embedding" AFTER INSERT OR UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."on_activity_change_for_embedding"();



CREATE OR REPLACE TRIGGER "trigger_update_activity_embedding_on_skill" AFTER INSERT OR DELETE OR UPDATE ON "public"."activity_skills" FOR EACH ROW EXECUTE FUNCTION "public"."on_activity_skill_change_for_embedding"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_embedding" AFTER INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."on_profile_change_for_embedding"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_embedding_on_interest" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_interests" FOR EACH ROW EXECUTE FUNCTION "public"."on_interest_change_for_embedding"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_embedding_on_skill" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_skills" FOR EACH ROW EXECUTE FUNCTION "public"."on_skill_change_for_embedding"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_npo_id_fkey" FOREIGN KEY ("npo_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_skills"
    ADD CONSTRAINT "activity_skills_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_npo_id_fkey" FOREIGN KEY ("npo_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_linked_activity_id_fkey" FOREIGN KEY ("linked_activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."faq_feedback"
    ADD CONSTRAINT "faq_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gamification_state"
    ADD CONSTRAINT "fk_level" FOREIGN KEY ("level") REFERENCES "public"."levels"("id");



ALTER TABLE ONLY "public"."gamification_state"
    ADD CONSTRAINT "gamification_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_related_activity_id_fkey" FOREIGN KEY ("related_activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_related_conversation_id_fkey" FOREIGN KEY ("related_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_related_activity_id_fkey" FOREIGN KEY ("related_activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_related_conversation_id_fkey" FOREIGN KEY ("related_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."npo_followers"
    ADD CONSTRAINT "npo_followers_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."npo_followers"
    ADD CONSTRAINT "npo_followers_npo_id_fkey" FOREIGN KEY ("npo_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_ban_report_id_fkey" FOREIGN KEY ("ban_report_id") REFERENCES "public"."reports"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_npo_id_fkey" FOREIGN KEY ("npo_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_linked_activity_id_fkey" FOREIGN KEY ("linked_activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_reviews"
    ADD CONSTRAINT "volunteer_reviews_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_reviews"
    ADD CONSTRAINT "volunteer_reviews_npo_id_fkey" FOREIGN KEY ("npo_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_reviews"
    ADD CONSTRAINT "volunteer_reviews_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Activities viewable by everyone" ON "public"."activities" FOR SELECT USING (true);



CREATE POLICY "Activity skills viewable by everyone" ON "public"."activity_skills" FOR SELECT USING (true);



CREATE POLICY "Admins can read faq feedback" ON "public"."faq_feedback" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ADMIN'::"public"."user_role")))));



CREATE POLICY "Admins can update verification requests" ON "public"."verification_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ADMIN'::"public"."user_role")))));



CREATE POLICY "Admins can view all verification requests" ON "public"."verification_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ADMIN'::"public"."user_role")))));



CREATE POLICY "Applications viewable by NPO and Volunteer" ON "public"."applications" FOR SELECT USING ((("auth"."uid"() = "npo_id") OR ("auth"."uid"() = "volunteer_id")));



CREATE POLICY "Authenticated users can create posts" ON "public"."community_posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND ("public"."is_current_user_banned"() IS NOT TRUE)));



CREATE POLICY "Authenticated users can insert conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert participants" ON "public"."conversation_participants" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view all gamification states" ON "public"."gamification_state" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Followers viewable by everyone" ON "public"."npo_followers" FOR SELECT USING (true);



CREATE POLICY "Interests viewable by everyone" ON "public"."user_interests" FOR SELECT USING (true);



CREATE POLICY "NPO can manage participants" ON "public"."activity_participants" USING ((EXISTS ( SELECT 1
   FROM "public"."activities"
  WHERE (("activities"."id" = "activity_participants"."activity_id") AND ("activities"."npo_id" = "auth"."uid"())))));



CREATE POLICY "NPOs can delete their volunteer reviews" ON "public"."volunteer_reviews" FOR DELETE USING (("auth"."uid"() = "npo_id"));



CREATE POLICY "NPOs can insert volunteer reviews" ON "public"."volunteer_reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "npo_id"));



CREATE POLICY "NPOs can manage activity skills" ON "public"."activity_skills" USING ((EXISTS ( SELECT 1
   FROM "public"."activities"
  WHERE (("activities"."id" = "activity_skills"."activity_id") AND ("activities"."npo_id" = "auth"."uid"())))));



CREATE POLICY "NPOs can manage own activities" ON "public"."activities" USING (("auth"."uid"() = "npo_id"));



CREATE POLICY "NPOs can manage participants in their activity group chats" ON "public"."conversation_participants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."activities" "a" ON (("a"."id" = "c"."activity_id")))
  WHERE (("c"."id" = "conversation_participants"."conversation_id") AND ("a"."npo_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."activities" "a" ON (("a"."id" = "c"."activity_id")))
  WHERE (("c"."id" = "conversation_participants"."conversation_id") AND ("a"."npo_id" = "auth"."uid"())))));



CREATE POLICY "NPOs can update status" ON "public"."applications" FOR UPDATE USING (("auth"."uid"() = "npo_id"));



CREATE POLICY "NPOs can update their volunteer reviews" ON "public"."volunteer_reviews" FOR UPDATE USING (("auth"."uid"() = "npo_id"));



CREATE POLICY "NPOs can view participants of their activity group chats" ON "public"."conversation_participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."activities" "a" ON (("a"."id" = "c"."activity_id")))
  WHERE (("c"."id" = "conversation_participants"."conversation_id") AND ("a"."npo_id" = "auth"."uid"())))));



CREATE POLICY "Participants can insert messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND ("public"."is_current_user_banned"() IS NOT TRUE) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Participants can update own status" ON "public"."activity_participants" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Participants viewable by everyone" ON "public"."activity_participants" FOR SELECT USING (true);



CREATE POLICY "Profiles insert own row" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Profiles select access" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("role" <> 'ADMIN'::"public"."user_role")));



CREATE POLICY "Profiles update own row" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Reviews are visible to everyone" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Skills viewable by everyone" ON "public"."user_skills" FOR SELECT USING (true);



CREATE POLICY "Stories are viewable by authenticated users" ON "public"."stories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "System/Trigger insert" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create their own blocks" ON "public"."blocked_users" FOR INSERT TO "authenticated" WITH CHECK (("blocker_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own requests" ON "public"."verification_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own stories" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own blocks" ON "public"."blocked_users" FOR DELETE TO "authenticated" USING (("blocker_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own interests" ON "public"."user_interests" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own skills" ON "public"."user_skills" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own stories" ON "public"."stories" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Users can follow" ON "public"."npo_followers" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert faq feedback" ON "public"."faq_feedback" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert reports" ON "public"."community_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can insert their own interests" ON "public"."user_interests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own skills" ON "public"."user_skills" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can join their own conversations" ON "public"."conversation_participants" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."can_add_private_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "Users can leave their own conversations" ON "public"."conversation_participants" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own interests" ON "public"."user_interests" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own skills" ON "public"."user_skills" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can mark read (update)" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read participants of their conversations" ON "public"."conversation_participants" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "Users can unfollow" ON "public"."npo_followers" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can update their own conversation state" ON "public"."conversation_participants" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notification preference" ON "public"."conversation_participants" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own participant read receipts" ON "public"."conversation_participants" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their own stories" ON "public"."stories" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "Users can view conversations they are part of" ON "public"."conversations" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR ("id" IN ( SELECT "public"."get_my_conversations"() AS "get_my_conversations"))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "public"."get_my_conversations"() AS "get_my_conversations")));



CREATE POLICY "Users can view participants of their conversations" ON "public"."conversation_participants" FOR SELECT USING (("conversation_id" IN ( SELECT "public"."get_my_conversations"() AS "get_my_conversations")));



CREATE POLICY "Users can view their own blocks" ON "public"."blocked_users" FOR SELECT TO "authenticated" USING ((("blocker_id" = "auth"."uid"()) OR ("blocked_id" = "auth"."uid"())));



CREATE POLICY "Users can view their own interests" ON "public"."user_interests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own notification logs" ON "public"."notification_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view their own requests" ON "public"."verification_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own skills" ON "public"."user_skills" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Volunteer reviews are visible to everyone" ON "public"."volunteer_reviews" FOR SELECT USING (true);



CREATE POLICY "Volunteers can apply" ON "public"."applications" FOR INSERT WITH CHECK (("auth"."uid"() = "volunteer_id"));



CREATE POLICY "Volunteers can delete their reviews" ON "public"."reviews" FOR DELETE USING (("auth"."uid"() = "volunteer_id"));



CREATE POLICY "Volunteers can insert reviews" ON "public"."reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "volunteer_id"));



CREATE POLICY "Volunteers can join" ON "public"."activity_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Volunteers can leave activities" ON "public"."activity_participants" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Volunteers can update their reviews" ON "public"."reviews" FOR UPDATE USING (("auth"."uid"() = "volunteer_id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_read_audit_logs" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_current_user_admin"());



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faq_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gamification_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."internal_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete_own" ON "public"."messages" FOR DELETE USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_insert_participants" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"()))))));



CREATE POLICY "messages_no_send_if_blocked" ON "public"."messages" FOR INSERT WITH CHECK ((NOT (EXISTS ( SELECT 1
   FROM ("public"."blocked_users" "bu"
     JOIN "public"."conversation_participants" "cp" ON ((("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" <> "auth"."uid"()))))
  WHERE (("bu"."blocker_id" = "cp"."user_id") AND ("bu"."blocked_id" = "auth"."uid"()))))));



CREATE POLICY "messages_select_participants" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."notification_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_jobs service role only" ON "public"."notification_jobs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_rate_limits service role only" ON "public"."notification_rate_limits" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."npo_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_owner" ON "public"."community_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "posts_insert_npo" ON "public"."community_posts" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "author_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'NPO'::"public"."user_role"))))));



CREATE POLICY "posts_select" ON "public"."community_posts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reactions_delete" ON "public"."post_reactions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "reactions_insert" ON "public"."post_reactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "reactions_select" ON "public"."post_reactions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_insert_auth" ON "public"."reports" FOR INSERT WITH CHECK (true);



CREATE POLICY "reports_select_admin" ON "public"."reports" FOR SELECT TO "authenticated" USING ("public"."is_current_user_admin"());



CREATE POLICY "reports_update_admin" ON "public"."reports" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."runtime_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "runtime_settings service role only" ON "public"."runtime_settings" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stories_delete_owner" ON "public"."stories" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "stories_insert_npo" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "author_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'NPO'::"public"."user_role"))))));



CREATE POLICY "stories_select_active" ON "public"."stories" FOR SELECT TO "authenticated" USING (("expires_at" > "now"()));



ALTER TABLE "public"."user_interests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."volunteer_reviews" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_sync_chat_on_participation"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_sync_chat_on_participation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_sync_chat_on_participation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "record") TO "anon";
GRANT ALL ON FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "record") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "record") TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "public"."activities") TO "anon";
GRANT ALL ON FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "public"."activities") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_activity_completion_to_user"("p_user_id" "uuid", "p_activity_record" "public"."activities") TO "service_role";



GRANT ALL ON FUNCTION "public"."award_gamification_xp"("p_user_id" "uuid", "p_xp_amount" integer, "p_badge" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."award_gamification_xp"("p_user_id" "uuid", "p_xp_amount" integer, "p_badge" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_gamification_xp"("p_user_id" "uuid", "p_xp_amount" integer, "p_badge" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_edge_function_url"("p_function_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_level_from_xp"("p_xp" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_level_from_xp"("p_xp" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_level_from_xp"("p_xp" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."call_check_activity_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."call_generate_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_add_private_conversation_participant"("p_conversation_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_add_private_conversation_participant"("p_conversation_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_add_private_conversation_participant"("p_conversation_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_next_occurrence"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_next_occurrence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_next_occurrence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_activities_near_me"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_activities_near_me"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_activities_near_me"("user_lat" double precision, "user_lng" double precision, "radius_meters" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_activities_with_match"("p_user_id" "uuid", "p_category" "text", "p_search" "text", "p_center_lat" double precision, "p_center_lng" double precision, "p_radius_km" double precision, "p_limit" integer, "p_offset" integer, "p_skills" "text"[], "p_only_urgent" boolean, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_statuses" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_activities_with_match"("p_user_id" "uuid", "p_category" "text", "p_search" "text", "p_center_lat" double precision, "p_center_lng" double precision, "p_radius_km" double precision, "p_limit" integer, "p_offset" integer, "p_skills" "text"[], "p_only_urgent" boolean, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_statuses" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_activities_with_match"("p_user_id" "uuid", "p_category" "text", "p_search" "text", "p_center_lat" double precision, "p_center_lng" double precision, "p_radius_km" double precision, "p_limit" integer, "p_offset" integer, "p_skills" "text"[], "p_only_urgent" boolean, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_statuses" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_inbox"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_inbox"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_inbox"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_matching_volunteers"("p_activity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_matching_volunteers"("p_activity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_matching_volunteers"("p_activity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_blocked_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_blocked_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_blocked_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_conversations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_referral_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_referral_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_referral_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_report_count"("p_reported_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_report_count"("p_reported_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_report_count"("p_reported_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rls_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rls_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rls_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_messages_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_messages_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_messages_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_activity_completion_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_activity_completion_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_activity_completion_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auto_chat_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auto_chat_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auto_chat_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_checkin_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_checkin_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_checkin_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_gamification_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_gamification_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_gamification_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_participation_status_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_participation_status_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_participation_status_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hide_conversation_for_user"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."hide_conversation_for_user"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_conversation_for_user"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_community_moderator_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_process_notification_jobs"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_push_notification_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_banned"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_banned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_banned"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_activities"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_lat" double precision, "user_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."match_activities"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_lat" double precision, "user_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_activities"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_lat" double precision, "user_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_activity_category"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_activity_category"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_activity_category"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_skill_value"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_skill_value"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_skill_value"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admin_on_report"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admin_on_report"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admin_on_report"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_activity_change_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_activity_skill_change_for_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_activity_skill_change_for_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_activity_skill_change_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_interest_change_for_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_interest_change_for_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_interest_change_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_notification_inserted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_profile_change_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_skill_change_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_activity_share"("p_activity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_activity_share"("p_activity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_activity_share"("p_activity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_my_interests"("p_interests" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_my_interests"("p_interests" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_my_interests"("p_interests" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_my_interests"("p_interests" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_my_interests"("p_interests" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_my_interests"("p_interests" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_my_skills"("p_skills" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_my_skills"("p_skills" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_my_skills"("p_skills" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_my_skills"("p_skills" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_my_skills"("p_skills" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_my_skills"("p_skills" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_chat_message"("p_conversation_id" "uuid", "p_sender_id" "uuid", "p_content" "text", "p_metadata" json) TO "anon";
GRANT ALL ON FUNCTION "public"."send_chat_message"("p_conversation_id" "uuid", "p_sender_id" "uuid", "p_content" "text", "p_metadata" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_chat_message"("p_conversation_id" "uuid", "p_sender_id" "uuid", "p_content" "text", "p_metadata" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_notification_jobs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_notification_jobs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_notification_jobs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_notification_rate_limits_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_notification_rate_limits_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_notification_rate_limits_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_runtime_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_runtime_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_runtime_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."start_private_conversation_between"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_private_conversation_between"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_private_conversation_between"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_gamification_to_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_gamification_to_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_gamification_to_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_gamification_xp_to_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_gamification_xp_to_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_gamification_xp_to_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_group_conversation_participants"("p_conversation_id" "uuid", "p_activity_id" "uuid", "p_initiator_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_group_conversation_participants"("p_conversation_id" "uuid", "p_activity_id" "uuid", "p_initiator_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_group_conversation_participants"("p_conversation_id" "uuid", "p_activity_id" "uuid", "p_initiator_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_location_coords"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_location_coords"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_location_coords"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_application_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_application_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_application_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_follow_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_follow_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_follow_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_review_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_review_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_review_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."try_consume_notification_rate_limit"("p_scope_key" "text", "p_job_type" "text", "p_window_seconds" integer, "p_now" timestamp with time zone, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."try_consume_notification_rate_limit"("p_scope_key" "text", "p_job_type" "text", "p_window_seconds" integer, "p_now" timestamp with time zone, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."try_consume_notification_rate_limit"("p_scope_key" "text", "p_job_type" "text", "p_window_seconds" integer, "p_now" timestamp with time zone, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_activity_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_activity_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_activity_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_expired_activities"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_expired_activities"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_expired_activities"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_profile_core"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile_core"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile_core"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean, "p_volunteer_list_visible" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean, "p_volunteer_list_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile_settings"("p_allow_calls" boolean, "p_profile_public" boolean, "p_show_email" boolean, "p_show_volunteering_history" boolean, "p_volunteer_list_visible" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."activity_participants" TO "anon";
GRANT ALL ON TABLE "public"."activity_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_participants" TO "service_role";



GRANT ALL ON TABLE "public"."activity_skills" TO "anon";
GRANT ALL ON TABLE "public"."activity_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_skills" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."app_spatial_ref_sys" TO "anon";
GRANT ALL ON TABLE "public"."app_spatial_ref_sys" TO "authenticated";
GRANT ALL ON TABLE "public"."app_spatial_ref_sys" TO "service_role";
GRANT SELECT ON TABLE "public"."app_spatial_ref_sys" TO PUBLIC;



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."community_posts" TO "anon";
GRANT ALL ON TABLE "public"."community_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."community_posts" TO "service_role";



GRANT ALL ON TABLE "public"."community_reports" TO "anon";
GRANT ALL ON TABLE "public"."community_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."community_reports" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."faq_feedback" TO "anon";
GRANT ALL ON TABLE "public"."faq_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."gamification_state" TO "anon";
GRANT ALL ON TABLE "public"."gamification_state" TO "authenticated";
GRANT ALL ON TABLE "public"."gamification_state" TO "service_role";



GRANT ALL ON TABLE "public"."internal_secrets" TO "anon";
GRANT ALL ON TABLE "public"."internal_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."levels" TO "anon";
GRANT ALL ON TABLE "public"."levels" TO "authenticated";
GRANT ALL ON TABLE "public"."levels" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_jobs" TO "anon";
GRANT ALL ON TABLE "public"."notification_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."notification_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."npo_followers" TO "anon";
GRANT ALL ON TABLE "public"."npo_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."npo_followers" TO "service_role";



GRANT ALL ON TABLE "public"."post_reactions" TO "anon";
GRANT ALL ON TABLE "public"."post_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."runtime_settings" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."unread_message_counts" TO "anon";
GRANT ALL ON TABLE "public"."unread_message_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."unread_message_counts" TO "service_role";



GRANT ALL ON TABLE "public"."user_interests" TO "anon";
GRANT ALL ON TABLE "public"."user_interests" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interests" TO "service_role";



GRANT ALL ON TABLE "public"."user_skills" TO "anon";
GRANT ALL ON TABLE "public"."user_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."user_skills" TO "service_role";



GRANT ALL ON TABLE "public"."verification_requests" TO "anon";
GRANT ALL ON TABLE "public"."verification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_requests" TO "service_role";



GRANT ALL ON TABLE "public"."volunteer_reviews" TO "anon";
GRANT ALL ON TABLE "public"."volunteer_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteer_reviews" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






-- Baseline public schema snapshot generated from staging.
-- Purpose: bootstrap fresh environments (notably production) where the
-- historical migration chain is not replayable from zero.
-- Existing environments that already have this schema must mark this
-- migration as applied without executing it.
