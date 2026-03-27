-- 20260325090000_gamification_new_badges.sql
-- Aggiornamento trigger gamification per supportare i 4 nuovi Badge: Tuttofare, Fedelissimo, Gufo Notturno, Anniversario

-- 1. Aggiornamento funzione base per assegnare sempre l'Anniversario (anni) a chi è iscritto da oltre un anno
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Aggiornamento trigger per attività completata (aggiunta Tuttofare, Fedelissimo, Gufo Notturno)
CREATE OR REPLACE FUNCTION trigger_application_gamification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
