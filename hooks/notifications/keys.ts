export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string) => [...notificationKeys.all, "list", userId] as const,
  unreadCount: (userId: string) => [...notificationKeys.all, "unread-count", userId] as const,
};
