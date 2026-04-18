import { useCallback, useMemo } from "react";
import { useSegments } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { notificationKeys } from "./keys";
import {
  useAddNotificationMutation,
  useClearNotificationsMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "./mutations";
import { useNotificationNavigation } from "./routing";
import { useNotificationsQuery, useNotificationsUnreadCountQuery } from "./queries";
import { AppNotification } from "./types";

const QUIET_ROUTES = [
  "(volunteer)/settings",
  "(volunteer)/privacy",
  "(volunteer)/interests-skills",
  "blocked-users",
  "(volunteer)/referral",
  "help-center",
  "(npo)/settings",
  "(npo)/settings/privacy",
  "(npo)/edit-profile",
];

export function useNotificationsRuntimeEnabled() {
  const { user } = useAuth();
  const segments = useSegments();
  const segmentKey = segments.join("/");
  const isQuietRoute = QUIET_ROUTES.some((route) => segmentKey.includes(route));

  return {
    user,
    enabled: !!user && !isQuietRoute,
  };
}

export function useNotificationsDomain() {
  const queryClient = useQueryClient();
  const { user, enabled } = useNotificationsRuntimeEnabled();
  const notificationsQuery = useNotificationsQuery(user?.id, enabled);
  const unreadCountQuery = useNotificationsUnreadCountQuery(user?.id, enabled);
  const addNotificationMutation = useAddNotificationMutation();
  const markNotificationReadMutation = useMarkNotificationReadMutation(user?.id);
  const markAllNotificationsReadMutation = useMarkAllNotificationsReadMutation(user?.id);
  const clearNotificationsMutation = useClearNotificationsMutation(user?.id);
  const navigateToNotification = useNotificationNavigation(user?.role);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationKeys.list(user.id) }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(user.id) }),
    ]);
  }, [queryClient, user?.id]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await markNotificationReadMutation.mutateAsync(notificationId);
  }, [markNotificationReadMutation]);

  const openNotification = useCallback(
    async (
      notification: Pick<
        AppNotification,
        "id" | "type" | "title" | "message" | "activityId" | "applicationId" | "npoId" | "conversationId" | "payload"
      >
    ) => {
      if (notification.id) {
        try {
          await markAsRead(notification.id);
        } catch (error) {
          console.warn("[NotificationsDomain] Failed to mark notification as read before navigation", error);
        }
      }

      navigateToNotification(notification);
    },
    [markAsRead, navigateToNotification]
  );

  return useMemo(
    () => ({
      notifications: notificationsQuery.data ?? [],
      unreadCount: unreadCountQuery.data ?? 0,
      getUnreadCount: () => unreadCountQuery.data ?? 0,
      addNotification: async (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => {
        await addNotificationMutation.mutateAsync(notification);
        if (notification.userId && notification.userId === user?.id) {
          await refreshNotifications();
        }
      },
      markAsRead,
      markAllAsRead: async () => {
        await markAllNotificationsReadMutation.mutateAsync();
      },
      clearAll: async () => {
        await clearNotificationsMutation.mutateAsync();
      },
      openNotification,
      refreshNotifications,
    }),
    [
      notificationsQuery.data,
      unreadCountQuery.data,
      addNotificationMutation,
      user?.id,
      refreshNotifications,
      markAsRead,
      markAllNotificationsReadMutation,
      clearNotificationsMutation,
      openNotification,
    ]
  );
}
