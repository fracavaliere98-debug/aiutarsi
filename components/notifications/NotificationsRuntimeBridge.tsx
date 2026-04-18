import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useToast } from "../../context/ToastContext";
import { mapNotificationResponseData } from "../../hooks/notifications/mappers";
import { useNotificationsRealtimeSync } from "../../hooks/notifications/realtime";
import { useNotificationsDomain, useNotificationsRuntimeEnabled } from "../../hooks/notifications/useNotificationsDomain";

export function NotificationsRuntimeBridge() {
  const { showToast } = useToast();
  const { user, enabled } = useNotificationsRuntimeEnabled();
  const { openNotification } = useNotificationsDomain();
  const handledResponseIds = useRef<Set<string>>(new Set());

  useNotificationsRealtimeSync(user?.id, enabled, (notification) => {
    showToast("info", `${notification.title}: ${notification.message}`, 6000, {
      label: "VEDI",
      onPress: () => {
        void openNotification(notification);
      },
    });
  });

  useEffect(() => {
    if (Platform.OS === "web") return;

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

        notificationListener = Notifications.addNotificationReceivedListener(() => {});
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

  return null;
}
