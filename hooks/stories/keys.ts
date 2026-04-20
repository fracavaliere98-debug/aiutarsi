const ANONYMOUS_USER_KEY = "anonymous";

export const storiesKeys = {
  all: ["stories"] as const,
  feeds: (userId?: string) => [...storiesKeys.all, "feed", userId ?? ANONYMOUS_USER_KEY] as const,
  feed: (userId?: string) => [...storiesKeys.feeds(userId), "active"] as const,
  viewerStates: (userId?: string) => [...storiesKeys.all, "viewer-state", userId ?? ANONYMOUS_USER_KEY] as const,
  viewerState: (userId?: string) => [...storiesKeys.viewerStates(userId), "local"] as const,
  sharedVolunteerAuthors: (sharedNpoIdsKey: string, authorIdsKey: string) =>
    [...storiesKeys.all, "shared-volunteer-authors", sharedNpoIdsKey || "none", authorIdsKey || "none"] as const,
};
