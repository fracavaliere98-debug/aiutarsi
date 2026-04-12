import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityPost } from "../../types/community";
import { supabase } from "../../utils/supabase";
import { COMMUNITY_ACTIVITY_POSTS_LIMIT, COMMUNITY_FEED_PAGE_SIZE, COMMUNITY_POST_SELECT } from "./constants";
import { communityKeys } from "./keys";

type FeedPage = {
    posts: CommunityPost[];
    nextCursor?: string;
};

function normalizeCommunityPost(row: any): CommunityPost {
    return {
        ...row,
        author: Array.isArray(row?.author) ? (row.author[0] ?? null) : (row?.author ?? null),
        linked_activity: Array.isArray(row?.linked_activity) ? (row.linked_activity[0] ?? null) : (row?.linked_activity ?? null),
        reactions: Array.isArray(row?.reactions) ? row.reactions : [],
    } as CommunityPost;
}

function normalizeCommunityPosts(rows: any[] | null | undefined): CommunityPost[] {
    return (rows ?? []).map(normalizeCommunityPost);
}

async function getBlockedAuthorIds(userId?: string) {
    if (!userId) return [];

    const [{ data: iBlocked, error: iBlockedError }, { data: blockedMe, error: blockedMeError }] = await Promise.all([
        supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId),
        supabase.from("blocked_users").select("blocker_id").eq("blocked_id", userId),
    ]);

    if (iBlockedError) throw iBlockedError;
    if (blockedMeError) throw blockedMeError;

    const blocked = new Set<string>();
    iBlocked?.forEach((row: any) => blocked.add(row.blocked_id));
    blockedMe?.forEach((row: any) => blocked.add(row.blocker_id));
    return Array.from(blocked);
}

function buildPostsQuery(blockedAuthorIds: string[] = []) {
    let query = supabase
        .from("community_posts")
        .select(COMMUNITY_POST_SELECT)
        .not("status", "in", '("shadow_banned","removed")');

    if (blockedAuthorIds.length > 0) {
        const blockedList = blockedAuthorIds.map((id) => `"${id}"`).join(",");
        query = query.not("author_id", "in", `(${blockedList})`);
    }

    return query;
}

async function fetchCommunityFeedPage(userId?: string, cursor?: string): Promise<FeedPage> {
    const blockedAuthorIds = await getBlockedAuthorIds(userId);
    let query = buildPostsQuery(blockedAuthorIds)
        .order("created_at", { ascending: false })
        .limit(COMMUNITY_FEED_PAGE_SIZE);

    if (cursor) {
        query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;
    if (error) throw error;

    const posts = normalizeCommunityPosts(data as any[] | null | undefined);
    const nextCursor = posts.length === COMMUNITY_FEED_PAGE_SIZE
        ? posts[posts.length - 1]?.created_at || undefined
        : undefined;

    return { posts, nextCursor };
}

async function fetchActivityPosts(activityId: string, userId?: string): Promise<CommunityPost[]> {
    const blockedAuthorIds = await getBlockedAuthorIds(userId);
    const { data, error } = await buildPostsQuery(blockedAuthorIds)
        .eq("linked_activity_id", activityId)
        .order("created_at", { ascending: false })
        .limit(COMMUNITY_ACTIVITY_POSTS_LIMIT);

    if (error) throw error;
    return normalizeCommunityPosts(data as any[] | null | undefined);
}

async function fetchCommunityPost(postId: string): Promise<CommunityPost | null> {
    const { data, error } = await supabase
        .from("community_posts")
        .select(COMMUNITY_POST_SELECT)
        .eq("id", postId)
        .single();

    if (error) throw error;
    return data ? normalizeCommunityPost(data) : null;
}

export function getCommunityPostFromFeedCache(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined, postId: string) {
    const feedData = queryClient.getQueryData<{ pages: FeedPage[] }>(communityKeys.feed(userId));
    const cachedFeedPost = feedData?.pages.flatMap((page) => page.posts).find((post) => post.id === postId);
    if (cachedFeedPost) return cachedFeedPost;

    const activityPostQueries = queryClient.getQueriesData<CommunityPost[]>({ queryKey: [...communityKeys.all, "activity-posts"] });
    for (const [, posts] of activityPostQueries) {
        const match = posts?.find((post) => post.id === postId);
        if (match) return match;
    }

    return undefined;
}

export function useCommunityFeedQuery(userId?: string, enabled = true) {
    return useInfiniteQuery({
        queryKey: communityKeys.feed(userId),
        queryFn: ({ pageParam }) => fetchCommunityFeedPage(userId, pageParam || undefined),
        initialPageParam: undefined as string | undefined,
        enabled,
        staleTime: 30_000,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
}

export function useCommunityActivityPostsQuery(activityId?: string, userId?: string, enabled = true) {
    return useQuery({
        queryKey: activityId ? communityKeys.activityPosts(userId, activityId) : communityKeys.all,
        queryFn: () => fetchActivityPosts(activityId!, userId),
        enabled: enabled && !!activityId,
        staleTime: 30_000,
    });
}

export function useCommunityPostQuery(
    postId?: string,
    options?: { enabled?: boolean; initialData?: CommunityPost | null; userId?: string }
) {
    return useQuery({
        queryKey: postId ? communityKeys.post(options?.userId, postId) : communityKeys.all,
        queryFn: () => fetchCommunityPost(postId!),
        enabled: (options?.enabled ?? true) && !!postId,
        initialData: options?.initialData ?? undefined,
        staleTime: 30_000,
    });
}
