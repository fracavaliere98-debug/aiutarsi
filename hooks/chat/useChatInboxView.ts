import { useCallback, useMemo } from "react";
import { useChatInboxRealtime } from "./realtime";
import { useChatInboxQuery } from "./queries";
import { EMPTY_CHAT_CONVERSATIONS, getChatUnreadCount } from "./selectors";

export function useChatInboxView(userId?: string, options?: { enabled?: boolean; realtime?: boolean }) {
  const enabled = options?.enabled ?? true;
  const realtime = options?.realtime ?? true;

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
    await query.refetch();
  }, [query]);

  return {
    conversations,
    unreadCount,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    refreshInbox,
  };
}
