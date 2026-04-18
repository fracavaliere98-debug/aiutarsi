import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatInboxRealtime } from "./realtime";
import { useChatInboxQuery } from "./queries";
import { chatKeys } from "./keys";
import { EMPTY_CHAT_CONVERSATIONS, getChatUnreadCount } from "./selectors";

export function useChatInboxView(userId?: string, options?: { enabled?: boolean; realtime?: boolean }) {
  const enabled = options?.enabled ?? true;
  const realtime = options?.realtime ?? true;
  const queryClient = useQueryClient();

  const query = useChatInboxQuery(userId, enabled);
  useChatInboxRealtime(userId, enabled && realtime);

  const conversations = useMemo(
    () => query.data ?? EMPTY_CHAT_CONVERSATIONS,
    [query.data]
  );

  const unreadCount = useMemo(
    () => getChatUnreadCount(conversations),
    [conversations]
  );

  const refreshInbox = useCallback(async () => {
    if (!userId) return;

    await Promise.all([
      queryClient.refetchQueries({ queryKey: chatKeys.inbox(userId), exact: true }),
      queryClient.refetchQueries({ queryKey: chatKeys.unreadCount(userId), exact: true }),
    ]);
  }, [queryClient, userId]);

  return {
    conversations,
    unreadCount,
    isLoading: query.isLoading,
    isRefreshing: false,
    refreshInbox,
  };
}
