import { useChatInboxView } from "./chat/useChatInboxView";

export function useConversations(userId: string | undefined) {
  const { conversations, isLoading, refreshInbox } = useChatInboxView(userId);

  return {
    conversations,
    isLoading,
    isError: false,
    refetch: refreshInbox,
  };
}
