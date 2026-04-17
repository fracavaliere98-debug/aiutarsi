export const chatKeys = {
  all: ["chat"] as const,
  inbox: (userId?: string) => [...chatKeys.all, "inbox", userId ?? "anonymous"] as const,
  unreadCount: (userId?: string) => [...chatKeys.all, "unread-count", userId ?? "anonymous"] as const,
  conversation: (conversationId?: string) => [...chatKeys.all, "conversation", conversationId ?? "unknown"] as const,
  messages: (conversationId?: string) => [...chatKeys.all, "messages", conversationId ?? "unknown"] as const,
  conversationMembers: (conversationId?: string) => [...chatKeys.all, "conversation-members", conversationId ?? "unknown"] as const,
  availableEntities: (userId?: string, role?: string) => [...chatKeys.all, "available-entities", userId ?? "anonymous", role ?? "unknown"] as const,
};
