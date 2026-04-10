import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { useSegments } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { notificationKeys } from "../hooks/notifications/keys";
import {
  useAddNotificationMutation,
  useClearNotificationsMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../hooks/notifications/mutations";
import { mapNotificationResponseData } from "../hooks/notifications/mappers";
import { useNotificationNavigation } from "../hooks/notifications/routing";
import { useNotificationsQuery, useNotificationsUnreadCountQuery } from "../hooks/notifications/queries";
import { useNotificationsRealtimeSync } from "../hooks/notifications/realtime";
import { AppNotification } from "../hooks/notifications/types";

export type { AppNotification } from "../hooks/notifications/types";

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  getUnreadCount: () => number;
  unreadCount: number;
  openNotification: (
    notification: Pick<AppNotification, "id" | "type" | "activityId" | "applicationId" | "npoId" | "conversationId">
  ) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const segments = useSegments();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const handledResponseIds = useRef<Set<string>>(new Set());

  const segmentKey = segments.join("/");
  const isQuietRoute = [
    "(volunteer)/settings",
    "(volunteer)/privacy",
    "(volunteer)/interests-skills",
    "blocked-users",
    "(volunteer)/referral",
    "help-center",
    "(npo)/settings",
    "(npo)/settings/privacy",
    "(npo)/edit-profile",
  ].some((route) => segmentKey.includes(route));

  const notificationsQuery = useNotificationsQuery(user?.id, !!user && !isQuietRoute);
  const unreadCountQuery = useNotificationsUnreadCountQuery(user?.id, !!user && !isQuietRoute);
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
      notification: Pick<AppNotification, "id" | "type" | "activityId" | "applicationId" | "npoId" | "conversationId">
    ) => {
      if (notification.id) {
        try {
          await markAsRead(notification.id);
        } catch (error) {
          console.warn("[NotificationContext] Failed to mark notification as read before navigation", error);
        }
      }
      navigateToNotification(notification);
    },
    [markAsRead, navigateToNotification]
  );

  useNotificationsRealtimeSync(user?.id, !!user && !isQuietRoute, (notification) => {
    showToast("info", `${notification.title}: ${notification.message}`, 6000, {
      label: "VEDI",
      onPress: () => {
        void openNotification(notification);
      },
    });
  });

  React.useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let isMounted = true;
    let notificationListener: { remove: () => void } | null = null;
    let responseListener: { remove: () => void } | null = null;

    const handleResponse = async (response: any | null) => {
      if (!response) return;

      const responseId = response.notification.request.identifier;
      if (handledResponseIds.current.has(responseId)) {
        return;
      }

      handledResponseIds.current.add(responseId);
      await openNotification(mapNotificationResponseData(response));
    };

    void import("expo-notifications")
      .then((Notifications) => {
        if (!isMounted) return;

        notificationListener = Notifications.addNotificationReceivedListener((event) => {
          console.log("Notification received in foreground (Expo):", event.request.content.data);
        });

        responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
          void handleResponse(response);
        });

        void Notifications.getLastNotificationResponseAsync()
          .then(handleResponse)
          .finally(() => Notifications.clearLastNotificationResponseAsync().catch(() => {}));
      })
      .catch((error) => {
        console.warn("[Push] Notification listeners unavailable:", error);
      });

    return () => {
      isMounted = false;
      notificationListener?.remove();
      responseListener?.remove();
    };
  }, [openNotification]);

  const value = useMemo(
    () => ({
      notifications: notificationsQuery.data || [],
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
      getUnreadCount: () => unreadCountQuery.data || 0,
      unreadCount: unreadCountQuery.data || 0,
      openNotification,
      refreshNotifications,
    }),
    [
      notificationsQuery.data,
      addNotificationMutation,
      user?.id,
      markAsRead,
      markAllNotificationsReadMutation,
      clearNotificationsMutation,
      unreadCountQuery.data,
      openNotification,
      refreshNotifications,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
