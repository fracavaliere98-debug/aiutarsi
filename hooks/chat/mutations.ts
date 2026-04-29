import { useMutation, useQueryClient } from "@tanstack/react-query";
import ChatService, { ChatFilterError } from "../../services/ChatService";
import { chatKeys } from "./keys";
import { applyConversationPreviewUpdate, getChatUnreadCount } from "./selectors";

function patchConversationReadState(conversations: any[] | null | undefined, conversationId: string) {
  const now = new Date().toISOString();

  return (conversations ?? []).map((conversation: any) => {
    if (conversation?.conversation_id !== conversationId) return conversation;

    return {
      ...conversation,
      last_read_at: now,
      unread_count: 0,
    };
  });
}

function invalidateChatInboxQueries(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.inbox(userId) }),
    queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount(userId) }),
  ]);
}

export function updateChatInboxPreviewCache(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  conversationId: string,
  content: string,
  senderId: string,
) {
  queryClient.setQueryData(chatKeys.inbox(userId), (previous: any[] | undefined) =>
    applyConversationPreviewUpdate(previous, conversationId, content, senderId)
  );
  queryClient.setQueryData(chatKeys.unreadCount(userId), (previous: number | undefined) => {
    if (typeof previous === "number") return previous;
    const conversations = queryClient.getQueryData<any[]>(chatKeys.inbox(userId));
    return getChatUnreadCount(conversations);
  });
}

export function useMarkConversationReadMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) throw new Error("Missing user");
      await ChatService.markAsRead(conversationId, userId);
      return conversationId;
    },
    onMutate: async (conversationId) => {
      queryClient.setQueryData(chatKeys.inbox(userId), (previous: any[] | undefined) =>
        patchConversationReadState(previous, conversationId)
      );
      const conversations = queryClient.getQueryData<any[]>(chatKeys.inbox(userId));
      queryClient.setQueryData(chatKeys.unreadCount(userId), getChatUnreadCount(conversations));
    },
    onSettled: () => {
      invalidateChatInboxQueries(queryClient, userId);
    },
  });
}

export function useHideConversationMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) throw new Error("Missing user");
      await ChatService.leaveConversation(conversationId, userId);
      return conversationId;
    },
    onSuccess: () => {
      invalidateChatInboxQueries(queryClient, userId);
    },
  });
}

export function useStartPrivateConversationMutation(userId?: string) {
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error("Missing user");
      return ChatService.startPrivateConversation(userId, targetUserId);
    },
  });
}

export function useStartGroupConversationMutation(userId?: string) {
  return useMutation({
    mutationFn: async ({ activityId, title }: { activityId: string; title: string }) => {
      return ChatService.startGroupConversation(activityId, title, userId);
    },
  });
}

export function useToggleConversationNotificationsMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, muted }: { conversationId: string; muted: boolean }) => {
      if (!userId) throw new Error("Missing user");
      await ChatService.toggleNotifications(conversationId, userId, muted);
      return { conversationId, muted };
    },
    onSuccess: ({ conversationId }) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.conversationMembers(conversationId) }),
      ]);
    },
  });
}

export function useBlockUserMutation(blockerId?: string) {
  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!blockerId) throw new Error("Missing user");
      await ChatService.blockUser(blockerId, targetId);
      return targetId;
    },
  });
}

export function useUnblockUserMutation(blockerId?: string) {
  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!blockerId) throw new Error("Missing user");
      await ChatService.unblockUser(blockerId, targetId);
      return targetId;
    },
  });
}

function prependMessagePage(
  previous: { pages: Array<{ messages: any[]; nextCursor?: string }>; pageParams: unknown[] } | undefined,
  message: any,
) {
  if (!previous || previous.pages.length === 0) {
    return {
      pages: [{ messages: [message], nextCursor: undefined }],
      pageParams: [undefined],
    };
  }

  const [firstPage, ...restPages] = previous.pages;
  return {
    ...previous,
    pages: [
      { ...firstPage, messages: [message, ...firstPage.messages.filter((item: any) => item.id !== message.id)] },
      ...restPages,
    ],
  };
}

export function useSendMessageMutation(userId?: string, conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, metadata }: { content: string; metadata?: any }) => {
      if (!userId || !conversationId) throw new Error("Missing conversation context");
      return ChatService.sendMessage(conversationId, userId, content, metadata);
    },
    onSuccess: (message) => {
      if (!conversationId || !userId) return;

      queryClient.setQueryData(
        chatKeys.messages(conversationId),
        (previous: { pages: Array<{ messages: any[]; nextCursor?: string }>; pageParams: unknown[] } | undefined) =>
          prependMessagePage(previous, message)
      );

      updateChatInboxPreviewCache(queryClient, userId, conversationId, message.content, message.sender_id);

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.inbox(userId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount(userId) }),
      ]);
    },
  });
}

export function useDeleteMessageMutation(userId?: string, conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!userId) throw new Error("Missing user");
      await ChatService.deleteMessage(messageId, userId);
      return messageId;
    },
    onSuccess: () => {
      if (!conversationId || !userId) return;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.inbox(userId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount(userId) }),
      ]);
    },
  });
}

export { ChatFilterError };
