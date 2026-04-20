const ANONYMOUS_USER_KEY = "anonymous";

export const storiesKeys = {
  all: ["stories"] as const,
  feeds: (userId?: string) => [...storiesKeys.all, "feed", userId ?? ANONYMOUS_USER_KEY] as const,
  feed: (userId?: string) => [...storiesKeys.feeds(userId), "active"] as const,
  views: (userId?: string) => [...storiesKeys.all, "views", userId ?? ANONYMOUS_USER_KEY] as const,
  localViews: (userId?: string) => [...storiesKeys.all, "local-views", userId ?? ANONYMOUS_USER_KEY] as const,
  sharedVolunteerAuthors: (sharedNpoIdsKey: string, authorIdsKey: string) =>
    [...storiesKeys.all, "shared-volunteer-authors", sharedNpoIdsKey || "none", authorIdsKey || "none"] as const,
};
