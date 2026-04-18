import { useCallback } from "react";
import { useRouter } from "expo-router";
import { AppNotification } from "./types";
import { resolveNotificationRoute } from "./routeResolver";

export function useNotificationNavigation(role: string | undefined) {
  const router = useRouter();

  return useCallback(
    (
      notification: Pick<
        AppNotification,
        "type" | "title" | "message" | "activityId" | "applicationId" | "npoId" | "conversationId" | "payload"
      >
    ) => {
      const route = resolveNotificationRoute(role, notification);
      router.push(route as any);
    },
    [role, router]
  );
}
