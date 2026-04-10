export type AppNotificationType =
  | "ACTIVITY_UPDATE"
  | "SUCCESS"
  | "INFO"
  | "URGENT"
  | "VOLUNTEER_ENROLLED"
  | "APPLICATION_RECEIVED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "SKILL_MATCH"
  | "GAMIFICATION_REMIND"
  | "BADGE_UNLOCKED"
  | "CHAT_MESSAGE"
  | "ACTIVITY_REMINDER"
  | "REVIEW_REMINDER"
  | "FOLLOWED_NPO_ACTIVITY"
  | "FOLLOWED_NPO_POST"
  | "FOLLOWED_NPO_STORY"
  | "NPO_WEEKLY_RECAP"
  | "VOLUNTEER_WEEKLY_RECAP"
  | "NPO_LOW_COVERAGE";

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  timestamp: string;
  activityId?: string;
  applicationId?: string;
  npoId?: string;
  conversationId?: string;
  read: boolean;
  userId: string;
  matchScore?: number;
}
