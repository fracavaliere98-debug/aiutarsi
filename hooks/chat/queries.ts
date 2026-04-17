import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import ChatService from "../../services/ChatService";
import { chatKeys } from "./keys";
import { getChatUnreadCount } from "./selectors";

const CHAT_PAGE_SIZE = 20;

type ChatMessagesPage = {
  messages: any[];
  nextCursor?: string;
};

async function fetchConversationMessagesPage(conversationId: string, cursor?: string): Promise<ChatMessagesPage> {
  const messages = await ChatService.getMessages(conversationId, cursor, CHAT_PAGE_SIZE);
  const nextCursor = messages.length === CHAT_PAGE_SIZE
    ? messages[messages.length - 1]?.created_at ?? undefined
    : undefined;

  return { messages, nextCursor };
}

export function useChatInboxQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.inbox(userId),
    queryFn: () => ChatService.getConversations(userId!),
    enabled: enabled && !!userId,
    staleTime: 0,
  });
}

export function useChatUnreadCountQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.inbox(userId),
    queryFn: () => ChatService.getConversations(userId!),
    enabled: enabled && !!userId,
    staleTime: 0,
    select: getChatUnreadCount,
  });
}

export function useConversationQuery(conversationId?: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => ChatService.getConversationMetadata(conversationId!),
    enabled: enabled && !!conversationId,
    staleTime: 0,
  });
}

export function useConversationMembersQuery(conversationId?: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.conversationMembers(conversationId),
    queryFn: async () => {
      const conversation = await ChatService.getConversationMetadata(conversationId!);
      return conversation?.participants ?? [];
    },
    enabled: enabled && !!conversationId,
    staleTime: 0,
  });
}

export function useConversationMessagesQuery(conversationId?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: ({ pageParam }) => fetchConversationMessagesPage(conversationId!, pageParam || undefined),
    enabled: enabled && !!conversationId,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useAvailableChatEntitiesQuery(userId?: string, role?: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.availableEntities(userId, role),
    enabled: enabled && !!userId && !!role,
    staleTime: 30_000,
    queryFn: async () => {
      if (role === "NPO") {
        const { volunteers, groups } = await ChatService.getAvailableEntitiesForNPO(userId!);
        return [
          ...groups.map((group: any) => ({ ...group, isGroup: true })),
          ...volunteers.map((volunteer: any) => ({ ...volunteer, isGroup: false })),
        ];
      }

      const { data } = await ChatService.getAvailableNpos(userId!);
      return (data ?? []).map((npo: any) => ({ ...npo, isGroup: false }));
    },
  });
}
