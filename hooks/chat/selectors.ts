export const EMPTY_CHAT_CONVERSATIONS: any[] = [];
export const EMPTY_CHAT_MESSAGES: any[] = [];
export const EMPTY_CHAT_PARTICIPANTS: any[] = [];

export function getChatUnreadCount(conversations: any[] | null | undefined) {
  return (conversations ?? []).reduce((acc: number, conversation: any) => {
    return acc + (conversation?.unread_count || 0);
  }, 0);
}

export function applyConversationPreviewUpdate(
  conversations: any[] | null | undefined,
  conversationId: string,
  content: string,
  senderId: string,
) {
  return (conversations ?? []).map((conversation: any) => {
    if (conversation?.conversation_id !== conversationId) return conversation;

    return {
      ...conversation,
      conversations: {
        ...conversation.conversations,
        last_message_content: content,
        last_message_at: new Date().toISOString(),
        last_message_sender_id: senderId,
      },
    };
  });
}

export function flattenMessagePages(data: { pages: Array<{ messages: any[] }> } | undefined) {
  return data?.pages.flatMap((page) => page.messages) ?? EMPTY_CHAT_MESSAGES;
}

export function getConversationParticipants(conversation: any) {
  return conversation?.participants ?? EMPTY_CHAT_PARTICIPANTS;
}
