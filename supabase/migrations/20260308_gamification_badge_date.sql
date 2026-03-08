-- 1. Aggiornamento funzione award_gamification_xp per includere dateEarned nei badge
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
    v_badge_with_date jsonb;
BEGIN
    -- Recupera o crea lo stato
    SELECT * INTO v_state FROM gamification_state WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        v_badge_with_date := '[]'::jsonb;
        IF p_badge IS NOT NULL THEN
            -- Inietta dateEarned nel badge nuovo
            v_badge_with_date := jsonb_build_array(p_badge || jsonb_build_object('dateEarned', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
        END IF;
        
        INSERT INTO gamification_state (user_id, xp, level, badges, completed_activities_count, total_hours)
        VALUES (p_user_id, p_xp_amount, calculate_level_from_xp(p_xp_amount), v_badge_with_date, 0, 0)
        RETURNING * INTO v_state;
    ELSE
        v_new_xp := v_state.xp + p_xp_amount;
        v_new_level := calculate_level_from_xp(v_new_xp);
        
        v_badges := v_state.badges;
        IF p_badge IS NOT NULL THEN
            IF v_badges IS NULL Then v_badges := '[]'::jsonb; END IF;
            -- Controlla se il badge esiste già
            IF NOT (v_badges @> jsonb_build_array(jsonb_build_object('id', p_badge->>'id'))) THEN
                -- Aggiungi il nuovo badge con dateEarned
                v_badges := v_badges || (p_badge || jsonb_build_object('dateEarned', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
            END IF;
        END IF;

        UPDATE gamification_state
        SET xp = v_new_xp,
            level = v_new_level,
            badges = v_badges,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- Sincronizza il punteggio sul profilo
    UPDATE profiles SET impact_points = v_new_xp WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Backfill dei badge esistenti per aggiungere dateEarned (usando la data di updated_at o NOW se assente)
UPDATE gamification_state gs
SET badges = (
    SELECT COALESCE(jsonb_agg(
        CASE 
            WHEN elem ? 'dateEarned' THEN elem
            ELSE elem || jsonb_build_object('dateEarned', to_char(COALESCE(gs.updated_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
        END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(gs.badges) AS elem
)
WHERE jsonb_typeof(gs.badges) = 'array' AND jsonb_array_length(gs.badges) > 0;
