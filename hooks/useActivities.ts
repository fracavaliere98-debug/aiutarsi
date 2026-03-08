/**
 * useActivities.ts
 * React Query hook for paginated activity fetching.
 * Replaces the manual fetchPaginatedActivities logic in ActivityContext.
 *
 * Usage:
 *   const { activities, fetchNextPage, hasNextPage, isFetching } = useActivities(filters);
 *
 * Invalidation — call after mutations (enroll, create, delete):
 *   queryClient.invalidateQueries({ queryKey: ['activities'] });
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { activityService } from '../services/ActivityService';
import { AppActivity } from '../types';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 15;

export interface ActivityFilters {
    category?: string;
    searchText?: string;
    skills?: string[];
    onlyAvailable?: boolean;
    onlyUrgent?: boolean;
    dateFrom?: string;
    dateTo?: string;
    centerLat?: number;
    centerLng?: number;
    radiusKm?: number;
    statuses?: string[];
}

export function useActivities(filters: ActivityFilters = {}) {
    const { user } = useAuth();
    const query = useInfiniteQuery<
        { activities: AppActivity[]; hasMore: boolean; totalCount: number },
        Error,
        { pages: { activities: AppActivity[]; hasMore: boolean; totalCount: number }[] },
        ['activities', ActivityFilters],
        number
    >({
        queryKey: ['activities', filters],
        initialPageParam: 0,
        staleTime: 60_000, // activities stale after 1 minute
        queryFn: async ({ pageParam }) => {
            return activityService.getActivities({
                category: filters.category,
                searchText: filters.searchText,
                skills: filters.skills,
                onlyAvailable: filters.onlyAvailable,
                onlyUrgent: filters.onlyUrgent,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                centerLat: filters.centerLat,
                centerLng: filters.centerLng,
                radiusKm: filters.radiusKm,
                statuses: filters.statuses,
                offset: pageParam,
                limit: PAGE_SIZE,
                userId: user?.id
            });
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage.hasMore) return undefined;
            return allPages.reduce((sum, p) => sum + p.activities.length, 0);
        },
    });

    // Flatten pages into a single array
    const activities = query.data?.pages.flatMap((p) => p.activities) ?? [];

    return {
        activities,
        totalCount: query.data?.pages[0]?.totalCount ?? 0,
        hasNextPage: query.hasNextPage,
        isFetching: query.isFetching,
        isFetchingNextPage: query.isFetchingNextPage,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        fetchNextPage: query.fetchNextPage,
        refetch: query.refetch,
    };
}
