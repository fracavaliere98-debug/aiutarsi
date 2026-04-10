import { AppNotification, AppNotificationType } from "./types";

const KNOWN_NOTIFICATION_TYPES: AppNotificationType[] = [
  "ACTIVITY_UPDATE",
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

export function mapNotificationRow(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: normalizeNotificationType(row.type),
    title: row.title,
    message: row.message,
    read: !!row.read,
    activityId: row.related_activity_id ?? undefined,
    applicationId: row.related_application_id ?? undefined,
    npoId: row.related_npo_id ?? undefined,
    conversationId: row.related_conversation_id ?? undefined,
    timestamp: row.created_at,
    matchScore: row.match_score ?? undefined,
  };
}

export function mapNotificationResponseData(response: any) {
  const request = response.notification.request;
  const data = request.content.data ?? {};

  return {
    id: String((data as any).notificationId || request.identifier || ""),
    type: normalizeNotificationType((data as any).type),
    activityId: (data as any).activityId || (data as any).related_activity_id,
    applicationId: (data as any).applicationId || (data as any).related_application_id,
    npoId: (data as any).npoId || (data as any).related_npo_id,
    conversationId: (data as any).conversationId || (data as any).related_conversation_id,
  };
}
