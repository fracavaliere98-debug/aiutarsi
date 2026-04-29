import {
  extractNotificationTargets,
  mapNotificationRow,
  normalizeNotificationPayload,
  normalizeNotificationType,
} from "../hooks/notifications/mappers";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run() {
  assert(normalizeNotificationType("chat_message") === "CHAT_MESSAGE", "lowercase types should normalize");
  assert(normalizeNotificationType("unknown_type") === "INFO", "unknown types should fall back to INFO");

  assert(normalizeNotificationPayload(null) === undefined, "null payload should normalize to undefined");
  assert(normalizeNotificationPayload("bad") === undefined, "string payload should normalize to undefined");
  assert(normalizeNotificationPayload(["bad"]) === undefined, "array payload should normalize to undefined");

  const partial = normalizeNotificationPayload({
    activityId: "activity-payload",
    empty: "",
    nil: null,
    list: ["unexpected"],
  });
  assert(partial?.activityId === "activity-payload", "valid payload fields should survive");
  assert(!("empty" in partial!), "empty strings should be removed");
  assert(!("nil" in partial!), "null values should be removed");
  assert(!("list" in partial!), "arrays should be removed");

  const targets = extractNotificationTargets(
    { related_activity_id: "activity-column", related_conversation_id: "" },
    { activityId: "activity-payload", conversationId: "conversation-payload" }
  );
  assert(targets.activityId === "activity-column", "related_* columns should win over payload targets");
  assert(targets.conversationId === "conversation-payload", "payload targets should fill missing columns");

  const mapped = mapNotificationRow({
    id: "notif-1",
    user_id: "user-1",
    type: "CHAT_MESSAGE",
    title: null,
    message: undefined,
    read: false,
    related_conversation_id: "",
    created_at: "2026-04-29T00:00:00.000Z",
    payload: { conversationId: "conversation-1" },
  });
  assert(mapped.title === "", "missing titles should map to empty string");
  assert(mapped.message === "", "missing messages should map to empty string");
  assert(mapped.conversationId === "conversation-1", "payload should provide missing conversation target");

  console.log("PASS notification payload contract covers malformed and partial payloads");
}

run();
