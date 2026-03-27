-- Step 1: Add columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- Step 2: Create a function to generate unique referral codes if needed
-- For now we'll just use a default in handle_new_user, but we could make it more robust.

-- Step 3: Update handle_new_user to capture referred_by_id and set initial referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- Step 4: Update award_activity_completion_to_user to include referral award logic
CREATE OR REPLACE FUNCTION public.award_activity_completion_to_user(p_user_id uuid, p_activity_record public.activities)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;
;
