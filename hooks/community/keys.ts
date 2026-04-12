const ANONYMOUS_USER_KEY = "anonymous";

export const communityKeys = {
    all: ["community"] as const,
    feeds: (userId?: string) => [...communityKeys.all, "feed", userId ?? ANONYMOUS_USER_KEY] as const,
    feed: (userId?: string) => [...communityKeys.feeds(userId), "infinite"] as const,
    activityPosts: (userId: string | undefined, activityId: string) =>
        [...communityKeys.all, "activity-posts", userId ?? ANONYMOUS_USER_KEY, activityId] as const,
    posts: (userId?: string) => [...communityKeys.all, "post", userId ?? ANONYMOUS_USER_KEY] as const,
    post: (userId: string | undefined, postId: string) => [...communityKeys.posts(userId), postId] as const,
};
