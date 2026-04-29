import { AppNotification, AppNotificationType } from "./types";

const KNOWN_NOTIFICATION_TYPES: AppNotificationType[] = [
  "ACTIVITY_UPDATE",
  "ACTIVITY_COMPLETED",
  "SUCCESS",
  "INFO",
  "URGENT",
  "VOLUNTEER_ENROLLED",
  "APPLICATION_RECEIVED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "SKILL_MATCH",
  "GAMIFICATION_REMIND",
  "BADGE_UNLOCKED",
  "CHAT_MESSAGE",
  "ACTIVITY_REMINDER",
  "REVIEW_REMINDER",
  "FOLLOWED_NPO_ACTIVITY",
  "FOLLOWED_NPO_POST",
  "FOLLOWED_NPO_STORY",
  "NPO_WEEKLY_RECAP",
  "VOLUNTEER_WEEKLY_RECAP",
  "NPO_LOW_COVERAGE",
];

export function normalizeNotificationType(rawType: unknown): AppNotificationType {
  const normalized = String(rawType || "INFO").trim().toUpperCase() as AppNotificationType;
  return KNOWN_NOTIFICATION_TYPES.includes(normalized) ? normalized : "INFO";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeNotificationPayload(input: unknown): Record<string, unknown> | undefined {
  if (!isRecord(input)) return undefined;

  const normalized = Object.entries(input).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
    if (typeof value === "string" && value.trim() === "") return acc;
    if (Array.isArray(value)) return acc;
    acc[key] = value;
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

export function extractNotificationTargets(source: Record<string, unknown>, payload?: Record<string, unknown>) {
  return {
    activityId: pickString(source.related_activity_id, source.activityId, payload?.activityId, payload?.related_activity_id),
    applicationId: pickString(
      source.related_application_id,
      source.applicationId,
      payload?.applicationId,
      payload?.related_application_id
    ),
    npoId: pickString(source.related_npo_id, source.npoId, payload?.npoId, payload?.related_npo_id),
    conversationId: pickString(
      source.related_conversation_id,
      source.conversationId,
      payload?.conversationId,
      payload?.related_conversation_id
    ),
  };
}

export function mapNotificationRow(row: any): AppNotification {
  const payload = normalizeNotificationPayload(row.payload);
  const targets = extractNotificationTargets(row, payload);

  return {
    id: row.id,
    userId: row.user_id,
    type: normalizeNotificationType(row.type),
    title: typeof row.title === "string" ? row.title : "",
    message: typeof row.message === "string" ? row.message : "",
    read: !!row.read,
    activityId: targets.activityId,
    applicationId: targets.applicationId,
    npoId: targets.npoId,
    conversationId: targets.conversationId,
    timestamp: row.created_at,
    matchScore: row.match_score ?? undefined,
    payload,
  };
}

export function mapNotificationResponseData(response: any) {
  const request = response.notification.request;
  const data = request.content.data ?? {};
  const payload = normalizeNotificationPayload(data);
  const targets = extractNotificationTargets(isRecord(data) ? data : {}, payload);

  return {
    id: String((data as any).notificationId || request.identifier || ""),
    type: normalizeNotificationType((data as any).type),
    title: String(request.content.title || ""),
    message: String(request.content.body || ""),
    activityId: targets.activityId,
    applicationId: targets.applicationId,
    npoId: targets.npoId,
    conversationId: targets.conversationId,
    payload,
  };
}
