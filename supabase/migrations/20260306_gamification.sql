-- gamification.sql

-- 1. Helper function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(p_xp integer)
RETURNS integer AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Core RPC to add XP, check level up, and append a badge
CREATE OR REPLACE FUNCTION award_gamification_xp(
    p_user_id uuid,
    p_xp_amount integer,
    p_badge jsonb DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_state record;
    v_new_xp integer;
    v_new_level integer;
    v_badges jsonb;
BEGIN
    -- Get or create state
    SELECT * INTO v_state FROM gamification_state WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO gamification_state (user_id, xp, level, badges, completed_activities_count, total_hours)
        VALUES (p_user_id, p_xp_amount, calculate_level_from_xp(p_xp_amount), COALESCE(jsonb_build_array(p_badge), '[]'::jsonb), 0, 0)
        RETURNING * INTO v_state;
    ELSE
        v_new_xp := v_state.xp + p_xp_amount;
        v_new_level := calculate_level_from_xp(v_new_xp);
        
        v_badges := v_state.badges;
        IF p_badge IS NOT NULL THEN
            IF v_badges IS NULL Then v_badges := '[]'::jsonb; END IF;
            -- Check if badge exists
            IF NOT (v_badges @> jsonb_build_array(jsonb_build_object('id', p_badge->>'id'))) THEN
                v_badges := v_badges || p_badge;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger: Application Update (Accettata / Completata)
CREATE OR REPLACE FUNCTION trigger_application_gamification()
RETURNS TRIGGER AS $$
DECLARE
    v_activity record;
    v_duration_hours float;
    v_xp integer := 100;
    v_state gamification_state%ROWTYPE;
    v_new_count integer;
    v_bonus_xp integer := 0;
    v_badge jsonb := NULL;
    v_new_hours float;
BEGIN
    -- Only process when status changes
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;

    -- CANDIDATURA ACCETTATA -> +200 XP
    IF NEW.status = 'ACCETTATA' THEN
        PERFORM award_gamification_xp(NEW.volunteer_id, 200, NULL);
    END IF;

    -- ATTIVITÀ COMPLETATA -> Calcolo Badge e XP
    IF NEW.status = 'COMPLETATA' THEN
        SELECT * INTO v_activity FROM activities WHERE id = NEW.activity_id;
        v_duration_hours := EXTRACT(EPOCH FROM (v_activity.end_date_time - v_activity.date_time)) / 3600.0;
        
        IF v_duration_hours > 6 THEN v_xp := 200;
        ELSIF v_duration_hours > 3 THEN v_xp := 150;
        END IF;

        -- Get current state
        SELECT * INTO v_state FROM gamification_state WHERE user_id = NEW.volunteer_id;
        v_new_count := COALESCE(v_state.completed_activities_count, 0) + 1;
        v_new_hours := COALESCE(v_state.total_hours, 0) + v_duration_hours;

        -- Check Badges (Simplified for DB trigger)
        IF v_new_count = 1 THEN
            v_badge := '{"id": "debt", "name": "Debuttante", "icon": "🌱", "description": "Hai completato la tua prima attività!", "color": "bg-green-100"}';
        ELSIF v_new_count = 10 THEN
            v_badge := '{"id": "pila", "name": "Pilastro", "icon": "🏛️", "description": "Hai completato 10 attività. Solido come una roccia.", "color": "bg-blue-100"}';
        ELSIF v_duration_hours > 6 THEN
            v_badge := '{"id": "stac", "name": "Stacanovista", "icon": "🏎️", "description": "Hai partecipato a una maratona di volontariato (>6h). Wow!", "color": "bg-red-100"}';
        ELSIF v_new_hours >= 100 AND (v_state.badges IS NULL OR NOT (v_state.badges @> '[{"id": "vete"}]')) THEN
            v_badge := '{"id": "vete", "name": "Veterano", "icon": "🏅", "description": "Hai superato le 100 ore di volontariato. Un vero leader.", "color": "bg-yellow-100"}';
            v_bonus_xp := 1000;
        END IF;

        IF v_new_count % 10 = 0 THEN
            v_bonus_xp := v_bonus_xp + 1000;
        END IF;

        -- Update gamification_state custom fields directly first
        UPDATE gamification_state
        SET completed_activities_count = v_new_count,
            total_hours = v_new_hours,
            processed_activity_ids = array_append(processed_activity_ids, NEW.activity_id::text)
        WHERE user_id = NEW.volunteer_id;
        
        -- Add XP and Badge
        PERFORM award_gamification_xp(NEW.volunteer_id, v_xp + v_bonus_xp, v_badge);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_application_status_change ON applications;
CREATE TRIGGER on_application_status_change
    AFTER UPDATE OF status ON applications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_application_gamification();

-- 4. Trigger: Follow NPO -> +10 XP and Networker Badge
CREATE OR REPLACE FUNCTION trigger_follow_gamification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_npo_follow ON npo_followers;
CREATE TRIGGER on_npo_follow
    AFTER INSERT ON npo_followers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_follow_gamification();

-- 5. Trigger: Reviews -> +150 XP bonus for 5 reviews
CREATE OR REPLACE FUNCTION trigger_review_gamification()
RETURNS TRIGGER AS $$
DECLARE
    v_count integer;
    v_badge jsonb := NULL;
    v_xp integer := 0;
BEGIN
    -- Count volunteer reviews
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_volunteer_review ON reviews;
CREATE TRIGGER on_volunteer_review
    AFTER INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_review_gamification();

-- 6. RPC: Client-driven Share Action
CREATE OR REPLACE FUNCTION record_activity_share(p_activity_id uuid)
RETURNS void AS $$
DECLARE
    v_state record;
    v_shared_count integer;
    v_badge jsonb := NULL;
BEGIN
    SELECT * INTO v_state FROM gamification_state WHERE user_id = auth.uid();
    
    -- Prevent duplicate share rewards for same activity
    IF v_state.shared_activity_ids @> ARRAY[p_activity_id::text] THEN
        RETURN; 
    END IF;

    v_shared_count := COALESCE(array_length(v_state.shared_activity_ids, 1), 0) + 1;
    
    IF v_shared_count = 10 THEN
        v_badge := '{"id": "voce", "name": "Voce del Popolo", "icon": "📢", "description": "Hai condiviso 10 attività. Grazie per il passaparola!", "color": "bg-yellow-100"}';
    END IF;

    UPDATE gamification_state 
    SET shared_activity_ids = array_append(shared_activity_ids, p_activity_id::text)
    WHERE user_id = auth.uid();

    PERFORM award_gamification_xp(auth.uid(), 10, v_badge);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. SECURE THE gamification_state TABLE
-- Remove the ALL policy that lets users update it directly
DROP POLICY IF EXISTS "Users can update their own gamification state" ON gamification_state;
-- (Users can view their own gamification state remains intact)
