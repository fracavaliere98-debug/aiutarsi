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
