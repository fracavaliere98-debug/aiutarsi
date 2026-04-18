export const NOTIFICATION_FETCH_LIMIT = 50;

export const NOTIFICATION_SELECT_FIELDS = [
  "id",
  "user_id",
  "type",
  "title",
  "message",
  "read",
  "related_activity_id",
  "related_application_id",
  "related_npo_id",
  "related_conversation_id",
  "created_at",
  "match_score",
  "payload",
].join(",");
