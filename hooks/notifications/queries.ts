import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { NOTIFICATION_FETCH_LIMIT, NOTIFICATION_SELECT_FIELDS } from "./constants";
import { notificationKeys } from "./keys";
import { mapNotificationRow } from "./mappers";

async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT_FIELDS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_FETCH_LIMIT);

  if (error) throw error;
  return (data || []).map(mapNotificationRow);
}

async function fetchUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
  return count || 0;
}

export function useNotificationsQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: userId ? notificationKeys.list(userId) : notificationKeys.all,
    queryFn: () => fetchNotifications(userId!),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

export function useNotificationsUnreadCountQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: userId ? notificationKeys.unreadCount(userId) : notificationKeys.all,
    queryFn: () => fetchUnreadCount(userId!),
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}
