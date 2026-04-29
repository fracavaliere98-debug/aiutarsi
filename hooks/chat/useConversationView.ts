import { useCallback, useMemo } from "react";
import { useConversationRealtime } from "./realtime";
import { useConversationMessagesQuery, useConversationQuery } from "./queries";
import { EMPTY_CHAT_PARTICIPANTS, flattenMessagePages, getConversationParticipants } from "./selectors";

export function useConversationView(conversationId?: string, userId?: string, options?: { enabled?: boolean; realtime?: boolean }) {
  const enabled = options?.enabled ?? true;
  const realtime = options?.realtime ?? true;

  const conversationQuery = useConversationQuery(conversationId, enabled);
  const messagesQuery = useConversationMessagesQuery(conversationId, enabled);

  useConversationRealtime(conversationId, userId, enabled && realtime);

  const conversation = conversationQuery.data ?? null;
  const participants = useMemo(
    () => getConversationParticipants(conversation) ?? EMPTY_CHAT_PARTICIPANTS,
    [conversation]
  );
  const messages = useMemo(
    () => flattenMessagePages(messagesQuery.data),
    [messagesQuery.data]
  );

  const refreshConversation = useCallback(async () => {
    await Promise.all([
      conversationQuery.refetch(),
      messagesQuery.refetch(),
    ]);
  }, [conversationQuery, messagesQuery]);

  const loadMoreMessages = useCallback(async () => {
    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) return;
    await messagesQuery.fetchNextPage();
  }, [messagesQuery]);

  const refreshMetadata = useCallback(async () => {
    await conversationQuery.refetch();
  }, [conversationQuery]);

  const refreshMessages = useCallback(async () => {
    await messagesQuery.refetch();
  }, [messagesQuery]);

  return {
    conversation,
    participants,
    messages,
    isLoadingConversation: conversationQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
    isRefreshing: conversationQuery.isRefetching || messagesQuery.isRefetching,
    isLoadingMoreMessages: messagesQuery.isFetchingNextPage,
    hasMoreMessages: messagesQuery.hasNextPage ?? false,
    refreshConversation,
    refreshMetadata,
    refreshMessages,
    loadMoreMessages,
  };
}
