/**
 * useActivities.ts
 * React Query hook for paginated activity fetching.
 * Canonical paginated list hook for the activities domain.
 *
 * Usage:
 *   const { activities, fetchNextPage, hasNextPage, isFetching } = useActivities(filters);
 *
 * Invalidation — call after mutations (enroll, create, delete):
 *   queryClient.invalidateQueries({ queryKey: ['activities'] });
 */
import { useAuth } from '../context/AuthContext';
import { usePaginatedActivitiesQuery } from './activities/queries';
import { ActivityFilters } from './activities/types';

export function useActivities(filters: ActivityFilters = {}) {
    const { user } = useAuth();
    const query = usePaginatedActivitiesQuery(user?.id, filters);

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
