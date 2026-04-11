import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { activityService } from "../../services/ActivityService";
import { AppActivity } from "../../types";
import { activityKeys } from "./keys";
import { ActivityFilters } from "./types";

const PAGE_SIZE = 15;

export function useActivitiesListQuery(userId?: string) {
    return useQuery({
        queryKey: activityKeys.list(userId),
        queryFn: async () => (await activityService.getActivities({ userId })).activities,
        placeholderData: (previousData) => previousData,
        staleTime: 60_000,
    });
}

export function usePaginatedActivitiesQuery(userId: string | undefined, filters: ActivityFilters = {}) {
    return useInfiniteQuery<
        { activities: AppActivity[]; hasMore: boolean; totalCount: number },
        Error,
        { pages: { activities: AppActivity[]; hasMore: boolean; totalCount: number }[] },
        ReturnType<typeof activityKeys.paginatedList>,
        number
    >({
        queryKey: activityKeys.paginatedList(userId, filters),
        initialPageParam: 0,
        placeholderData: (previousData) => previousData,
        staleTime: 60_000,
        refetchOnMount: true,
        refetchOnReconnect: true,
        retry: 1,
        queryFn: async ({ pageParam }) => {
            return activityService.getActivities({
                ...filters,
                offset: pageParam,
                limit: PAGE_SIZE,
                userId,
            });
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage.hasMore) return undefined;
            return allPages.reduce((sum, page) => sum + page.activities.length, 0);
        },
    });
}

export function useActivityDetailQuery(
    activityId?: string,
    options?: { initialData?: AppActivity | null }
) {
    return useQuery({
        queryKey: activityId ? activityKeys.detail(activityId) : activityKeys.details(),
        queryFn: async () => activityService.getActivityById(activityId!),
        enabled: !!activityId,
        initialData: options?.initialData ?? undefined,
        staleTime: 60_000,
    });
}

export function useActivityReviewsQuery() {
    return useQuery({
        queryKey: activityKeys.reviews(),
        queryFn: () => activityService.getReviews(),
        staleTime: 60_000,
    });
}

export function useVolunteerReviewsQuery() {
    return useQuery({
        queryKey: activityKeys.volunteerReviews(),
        queryFn: () => activityService.getVolunteerReviews(),
        staleTime: 60_000,
    });
}

export function useActivityApplicationsQuery(userId?: string, enabled = true) {
    return useQuery({
        queryKey: activityKeys.applications(userId),
        queryFn: () => activityService.getActivityApplications(),
        staleTime: 60_000,
        enabled: enabled && !!userId,
    });
}
