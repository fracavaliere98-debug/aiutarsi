import { useCallback, useMemo } from "react";
import { useCommunityFeedQuery } from "./queries";

const EMPTY_POSTS: any[] = [];

export function useCommunityFeedView(userId?: string, enabled = true) {
    const query = useCommunityFeedQuery(userId, enabled);

    const posts = useMemo(
        () => query.data?.pages.flatMap((page) => page.posts) ?? EMPTY_POSTS,
        [query.data]
    );

    const refreshFeed = useCallback(async () => {
        await query.refetch();
    }, [query]);

    const loadMoreFeed = useCallback(async () => {
        if (!query.hasNextPage || query.isFetchingNextPage) return;
        await query.fetchNextPage();
    }, [query]);

    return {
        posts,
        isLoading: query.isLoading,
        isRefreshing: query.isRefetching && !query.isFetchingNextPage,
        isLoadingMore: query.isFetchingNextPage,
        refreshFeed,
        loadMoreFeed,
    };
}
