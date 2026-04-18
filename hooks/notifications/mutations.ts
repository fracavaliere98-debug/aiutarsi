import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { notificationKeys } from "./keys";
import { AppNotification } from "./types";

async function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) }),
  ]);
}

export function useAddNotificationMutation() {
  return useMutation({
    mutationFn: async (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      const payload = {
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        related_activity_id: notification.activityId,
        related_application_id: notification.applicationId,
        related_npo_id: notification.npoId,
        related_conversation_id: notification.conversationId,
        match_score: notification.matchScore,
        payload: notification.payload ?? {},
        read: false,
      };

      const { error } = await supabase.from("notifications").insert(payload);
      if (error) throw error;
    },
  });
}

export function useMarkNotificationReadMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: async () => {
      if (!userId) return;
      await invalidateNotificationQueries(queryClient, userId);
    },
  });
}

export function useMarkAllNotificationsReadMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: async () => {
      if (!userId) return;
      await invalidateNotificationQueries(queryClient, userId);
    },
  });
}

export function useClearNotificationsMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) return;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: async () => {
      if (!userId) return;
      await invalidateNotificationQueries(queryClient, userId);
    },
  });
}
