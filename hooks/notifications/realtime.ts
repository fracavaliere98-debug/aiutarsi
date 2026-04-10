import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { notificationKeys } from "./keys";
import { mapNotificationRow } from "./mappers";
import { AppNotification } from "./types";

export function useNotificationsRealtimeSync(
  userId: string | undefined,
  enabled: boolean,
  onInsert?: (notification: AppNotification) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return;

    const invalidate = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) }),
      ]);
    };

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = mapNotificationRow(payload.new);
          onInsert?.(notification);
          void invalidate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void invalidate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onInsert, queryClient, userId]);
}
