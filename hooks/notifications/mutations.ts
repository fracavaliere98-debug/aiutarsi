import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { notificationKeys } from "./keys";

async function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) }),
  ]);
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
