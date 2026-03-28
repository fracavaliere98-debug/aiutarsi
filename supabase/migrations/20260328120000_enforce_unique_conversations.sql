ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS private_key text;

WITH private_conversation_keys AS (
  SELECT
    c.id AS conversation_id,
    string_agg(cp.user_id::text, ':' ORDER BY cp.user_id::text) AS pair_key,
    COUNT(*) AS participant_count
  FROM public.conversations c
  JOIN public.conversation_participants cp
    ON cp.conversation_id = c.id
  WHERE c.type = 'PRIVATE'
    AND c.activity_id IS NULL
  GROUP BY c.id
)
UPDATE public.conversations c
SET private_key = pck.pair_key
FROM private_conversation_keys pck
WHERE c.id = pck.conversation_id
  AND pck.participant_count = 2;

CREATE TEMP TABLE tmp_private_conversation_winners ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    c.id AS conversation_id,
    c.private_key,
    ROW_NUMBER() OVER (
      PARTITION BY c.private_key
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC, c.id DESC
    ) AS rn
  FROM public.conversations c
  WHERE c.type = 'PRIVATE'
    AND c.activity_id IS NULL
    AND c.private_key IS NOT NULL
)
SELECT private_key, conversation_id AS keeper_id
FROM ranked
WHERE rn = 1;

CREATE TEMP TABLE tmp_private_conversation_losers ON COMMIT DROP AS
SELECT
  c.id AS loser_id,
  w.keeper_id,
  c.private_key
FROM public.conversations c
JOIN tmp_private_conversation_winners w
  ON w.private_key = c.private_key
WHERE c.type = 'PRIVATE'
  AND c.activity_id IS NULL
  AND c.private_key IS NOT NULL
  AND c.id <> w.keeper_id;

INSERT INTO public.conversation_participants (
  conversation_id,
  user_id,
  last_read_at,
  inbox_visible_at,
  hidden_at,
  notifications_muted
)
SELECT
  l.keeper_id,
  cp.user_id,
  MAX(cp.last_read_at) AS last_read_at,
  MAX(cp.inbox_visible_at) AS inbox_visible_at,
  CASE
    WHEN bool_and(cp.hidden_at IS NOT NULL) THEN MAX(cp.hidden_at)
    ELSE NULL
  END AS hidden_at,
  bool_or(COALESCE(cp.notifications_muted, false)) AS notifications_muted
FROM tmp_private_conversation_losers l
JOIN public.conversation_participants cp
  ON cp.conversation_id = l.loser_id
GROUP BY l.keeper_id, cp.user_id
ON CONFLICT (conversation_id, user_id)
DO UPDATE SET
  last_read_at = GREATEST(public.conversation_participants.last_read_at, EXCLUDED.last_read_at),
  inbox_visible_at = GREATEST(public.conversation_participants.inbox_visible_at, EXCLUDED.inbox_visible_at),
  hidden_at = CASE
    WHEN public.conversation_participants.hidden_at IS NULL OR EXCLUDED.hidden_at IS NULL THEN NULL
    ELSE GREATEST(public.conversation_participants.hidden_at, EXCLUDED.hidden_at)
  END,
  notifications_muted = COALESCE(public.conversation_participants.notifications_muted, false) OR COALESCE(EXCLUDED.notifications_muted, false);

UPDATE public.messages m
SET conversation_id = l.keeper_id
FROM tmp_private_conversation_losers l
WHERE m.conversation_id = l.loser_id;

DELETE FROM public.conversation_participants cp
USING tmp_private_conversation_losers l
WHERE cp.conversation_id = l.loser_id;

DELETE FROM public.conversations c
USING tmp_private_conversation_losers l
WHERE c.id = l.loser_id;

WITH group_ranked AS (
  SELECT
    c.id AS conversation_id,
    c.activity_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.activity_id
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC, c.id DESC
    ) AS rn
  FROM public.conversations c
  WHERE c.type = 'ACTIVITY_GROUP'
    AND c.activity_id IS NOT NULL
),
group_winners AS (
  SELECT activity_id, conversation_id AS keeper_id
  FROM group_ranked
  WHERE rn = 1
),
group_losers AS (
  SELECT
    c.id AS loser_id,
    gw.keeper_id
  FROM public.conversations c
  JOIN group_winners gw
    ON gw.activity_id = c.activity_id
  WHERE c.type = 'ACTIVITY_GROUP'
    AND c.activity_id IS NOT NULL
    AND c.id <> gw.keeper_id
)
INSERT INTO public.conversation_participants (
  conversation_id,
  user_id,
  last_read_at,
  inbox_visible_at,
  hidden_at,
  notifications_muted
)
SELECT
  gl.keeper_id,
  cp.user_id,
  MAX(cp.last_read_at) AS last_read_at,
  MAX(cp.inbox_visible_at) AS inbox_visible_at,
  CASE
    WHEN bool_and(cp.hidden_at IS NOT NULL) THEN MAX(cp.hidden_at)
    ELSE NULL
  END AS hidden_at,
  bool_or(COALESCE(cp.notifications_muted, false)) AS notifications_muted
FROM group_losers gl
JOIN public.conversation_participants cp
  ON cp.conversation_id = gl.loser_id
GROUP BY gl.keeper_id, cp.user_id
ON CONFLICT (conversation_id, user_id)
DO UPDATE SET
  last_read_at = GREATEST(public.conversation_participants.last_read_at, EXCLUDED.last_read_at),
  inbox_visible_at = GREATEST(public.conversation_participants.inbox_visible_at, EXCLUDED.inbox_visible_at),
  hidden_at = CASE
    WHEN public.conversation_participants.hidden_at IS NULL OR EXCLUDED.hidden_at IS NULL THEN NULL
    ELSE GREATEST(public.conversation_participants.hidden_at, EXCLUDED.hidden_at)
  END,
  notifications_muted = COALESCE(public.conversation_participants.notifications_muted, false) OR COALESCE(EXCLUDED.notifications_muted, false);

WITH group_losers AS (
  SELECT
    c.id AS loser_id,
    gw.keeper_id
  FROM public.conversations c
  JOIN (
    SELECT activity_id, conversation_id AS keeper_id
    FROM (
      SELECT
        c.activity_id,
        c.id AS conversation_id,
        ROW_NUMBER() OVER (
          PARTITION BY c.activity_id
          ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC, c.id DESC
        ) AS rn
      FROM public.conversations c
      WHERE c.type = 'ACTIVITY_GROUP'
        AND c.activity_id IS NOT NULL
    ) ranked
    WHERE rn = 1
  ) gw
    ON gw.activity_id = c.activity_id
  WHERE c.type = 'ACTIVITY_GROUP'
    AND c.activity_id IS NOT NULL
    AND c.id <> gw.keeper_id
)
UPDATE public.messages m
SET conversation_id = gl.keeper_id
FROM group_losers gl
WHERE m.conversation_id = gl.loser_id;

WITH group_losers AS (
  SELECT
    c.id AS loser_id
  FROM public.conversations c
  JOIN (
    SELECT activity_id, conversation_id AS keeper_id
    FROM (
      SELECT
        c.activity_id,
        c.id AS conversation_id,
        ROW_NUMBER() OVER (
          PARTITION BY c.activity_id
          ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC, c.id DESC
        ) AS rn
      FROM public.conversations c
      WHERE c.type = 'ACTIVITY_GROUP'
        AND c.activity_id IS NOT NULL
    ) ranked
    WHERE rn = 1
  ) gw
    ON gw.activity_id = c.activity_id
  WHERE c.type = 'ACTIVITY_GROUP'
    AND c.activity_id IS NOT NULL
    AND c.id <> gw.keeper_id
)
DELETE FROM public.conversation_participants cp
USING group_losers gl
WHERE cp.conversation_id = gl.loser_id;

WITH group_losers AS (
  SELECT
    c.id AS loser_id
  FROM public.conversations c
  JOIN (
    SELECT activity_id, conversation_id AS keeper_id
    FROM (
      SELECT
        c.activity_id,
        c.id AS conversation_id,
        ROW_NUMBER() OVER (
          PARTITION BY c.activity_id
          ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC, c.id DESC
        ) AS rn
      FROM public.conversations c
      WHERE c.type = 'ACTIVITY_GROUP'
        AND c.activity_id IS NOT NULL
    ) ranked
    WHERE rn = 1
  ) gw
    ON gw.activity_id = c.activity_id
  WHERE c.type = 'ACTIVITY_GROUP'
    AND c.activity_id IS NOT NULL
    AND c.id <> gw.keeper_id
)
DELETE FROM public.conversations c
USING group_losers gl
WHERE c.id = gl.loser_id;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_private_key_idx
  ON public.conversations(private_key)
  WHERE type = 'PRIVATE' AND activity_id IS NULL AND private_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_activity_group_idx
  ON public.conversations(activity_id)
  WHERE type = 'ACTIVITY_GROUP' AND activity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.start_private_conversation_between(
  p_user_id_1 uuid,
  p_user_id_2 uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.start_private_conversation_between(uuid, uuid) TO authenticated;
