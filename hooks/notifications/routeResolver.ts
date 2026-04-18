import { AppNotification } from "./types";

function getCommunityRoute(role: string | undefined) {
  return role === "NPO" ? "/(npo)/(tabs)/community" : "/(volunteer)/(tabs)/community";
}

function getNotificationsRoute(role: string | undefined) {
  return role === "NPO" ? "/(npo)/notifications" : "/(volunteer)/notifications";
}

function getProfileRoute(role: string | undefined) {
  return role === "NPO" ? "/(npo)/(tabs)/profile" : "/(volunteer)/(tabs)/profile";
}

function isReengagementNotification(
  notif: Pick<AppNotification, "title" | "message" | "payload">
) {
  if (notif.payload?.reengagement === true) return true;

  const title = (notif.title || "").toLowerCase();
  const message = (notif.message || "").toLowerCase();
  return (
    title.includes("riattiva la tua community") ||
    title.includes("torna a dare una mano") ||
    message.includes("tornare visibile ai volontari") ||
    message.includes("scopri una nuova attività")
  );
}

function isVerificationOutcomeNotification(
  notif: Pick<AppNotification, "title" | "message">
) {
  const title = (notif.title || "").toLowerCase();
  return title.includes("profilo verificato") || title.includes("richiesta di verifica respinta");
}

export function resolveNotificationRoute(
  role: string | undefined,
  notif: Pick<
    AppNotification,
    "type" | "title" | "message" | "activityId" | "applicationId" | "npoId" | "conversationId" | "payload"
  >
) {
  if (isReengagementNotification(notif)) {
    return getCommunityRoute(role);
  }

  switch (notif.type) {
    case "CHAT_MESSAGE":
      return notif.conversationId ? `/messages/${notif.conversationId}` : "/messages";
    case "APPLICATION_RECEIVED":
      return "/(npo)/volunteers?tab=CANDIDATURE";
    case "ACTIVITY_COMPLETED":
    case "VOLUNTEER_ENROLLED":
    case "SKILL_MATCH":
    case "ACTIVITY_UPDATE":
    case "ACTIVITY_REMINDER":
    case "REVIEW_REMINDER":
    case "FOLLOWED_NPO_ACTIVITY":
      return notif.activityId ? `/activity/${notif.activityId}` : getCommunityRoute(role);
    case "APPLICATION_APPROVED":
    case "APPLICATION_REJECTED":
      if (notif.activityId) return `/activity/${notif.activityId}`;
      if (notif.npoId) return `/npo-profile/${notif.npoId}`;
      return getNotificationsRoute(role);
    case "BADGE_UNLOCKED":
    case "GAMIFICATION_REMIND":
      return getProfileRoute(role);
    case "NPO_WEEKLY_RECAP":
      return "/(npo)/report";
    case "VOLUNTEER_WEEKLY_RECAP":
      return "/(volunteer)/report";
    case "NPO_LOW_COVERAGE":
      return notif.activityId ? `/activity/${notif.activityId}` : "/(npo)/report";
    case "FOLLOWED_NPO_POST":
    case "FOLLOWED_NPO_STORY":
      return getCommunityRoute(role);
    case "SUCCESS":
    case "INFO":
      if (isVerificationOutcomeNotification(notif)) {
        return getProfileRoute(role);
      }
      if (notif.activityId) return `/activity/${notif.activityId}`;
      return getNotificationsRoute(role);
    default:
      if (notif.activityId) return `/activity/${notif.activityId}`;
      return getNotificationsRoute(role);
  }
}
