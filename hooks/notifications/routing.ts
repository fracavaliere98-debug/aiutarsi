import { useCallback } from "react";
import { useRouter } from "expo-router";
import { AppNotification } from "./types";

export function resolveNotificationRoute(
  role: string | undefined,
  notif: Pick<AppNotification, "type" | "activityId" | "applicationId" | "npoId" | "conversationId">
) {
  switch (notif.type) {
    case "CHAT_MESSAGE":
      return notif.conversationId ? `/messages/${notif.conversationId}` : "/messages";
    case "APPLICATION_RECEIVED":
      return "/(npo)/volunteers?tab=CANDIDATURE";
    case "VOLUNTEER_ENROLLED":
    case "SKILL_MATCH":
    case "ACTIVITY_UPDATE":
    case "ACTIVITY_REMINDER":
    case "REVIEW_REMINDER":
    case "FOLLOWED_NPO_ACTIVITY":
      return notif.activityId
        ? `/activity/${notif.activityId}`
        : role === "NPO"
          ? "/(npo)/(tabs)/community"
          : "/(volunteer)/(tabs)/community";
    case "APPLICATION_APPROVED":
    case "APPLICATION_REJECTED":
      if (notif.activityId) return `/activity/${notif.activityId}`;
      if (notif.npoId) return `/npo-profile/${notif.npoId}`;
      return "/(volunteer)/notifications";
    case "BADGE_UNLOCKED":
    case "GAMIFICATION_REMIND":
      return role === "NPO" ? "/(npo)/(tabs)/profile" : "/(volunteer)/(tabs)/profile";
    case "NPO_WEEKLY_RECAP":
      return "/(npo)/report";
    case "VOLUNTEER_WEEKLY_RECAP":
      return "/(volunteer)/report";
    case "NPO_LOW_COVERAGE":
      return notif.activityId ? `/activity/${notif.activityId}` : "/(npo)/report";
    case "FOLLOWED_NPO_POST":
    case "FOLLOWED_NPO_STORY":
      if (notif.npoId) return `/npo-profile/${notif.npoId}`;
      return role === "NPO"
        ? "/(npo)/(tabs)/community"
        : "/(volunteer)/(tabs)/community";
    default:
      if (notif.activityId) return `/activity/${notif.activityId}`;
      return role === "NPO" ? "/(npo)/notifications" : "/(volunteer)/notifications";
  }
}

export function useNotificationNavigation(role: string | undefined) {
  const router = useRouter();

  return useCallback(
    (notification: Pick<AppNotification, "type" | "activityId" | "applicationId" | "npoId" | "conversationId">) => {
      const route = resolveNotificationRoute(role, notification);
      router.push(route as any);
    },
    [role, router]
  );
}
