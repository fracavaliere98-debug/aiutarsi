import { useMemo } from "react";
import { AppActivity, AppUser, OldReview } from "../../types";
import {
    useActivitiesListQuery,
    useActivityApplicationsQuery,
    useActivityReviewsQuery,
} from "./queries";
import {
    computeNPORating,
    computeVolunteerStats,
    filterActivitiesByOwner,
    filterReviewsByVolunteer,
    type VolunteerStats,
} from "./selectorsLogic";

export type { VolunteerStats };

const EMPTY_ACTIVITIES: AppActivity[] = [];
const EMPTY_REVIEWS: OldReview[] = [];
const EMPTY_ACTIVITY_APPLICATIONS: any[] = [];

export function useActivitiesDomain(user?: AppUser | null) {
    const { data: activities = EMPTY_ACTIVITIES, isError, refetch: refetchActivities } = useActivitiesListQuery(user?.id);
    const { data: reviews = EMPTY_REVIEWS, refetch: refetchReviews } = useActivityReviewsQuery();
    const {
        data: activityApplications = EMPTY_ACTIVITY_APPLICATIONS,
        refetch: refetchActivityApplications,
    } = useActivityApplicationsQuery(user?.id, !!user && user.role === "NPO");

    return {
        activities,
        reviews,
        activityApplications,
        error: isError,
        loadData: async () => {
            await Promise.all([
                refetchActivities(),
                refetchReviews(),
                refetchActivityApplications(),
            ]);
        },
    };
}

export function useVolunteerStats(user?: AppUser | null): VolunteerStats {
    const { activities = [] } = useActivitiesDomain(user);

    return useMemo(() => computeVolunteerStats(activities, user), [activities, user]);
}

export function useUserReviews(userId?: string) {
    const { data: reviews = EMPTY_REVIEWS } = useActivityReviewsQuery();

    return useMemo(() => filterReviewsByVolunteer(reviews, userId), [reviews, userId]);
}

export function useNPORating(npoId?: string) {
    const { data: reviews = EMPTY_REVIEWS } = useActivityReviewsQuery();

    return useMemo(() => computeNPORating(reviews, npoId), [npoId, reviews]);
}

export function useActivitiesByOwner(userId?: string): AppActivity[] {
    const { activities = [] } = useActivitiesDomain(userId ? ({ id: userId } as AppUser) : undefined);
    return useMemo(() => filterActivitiesByOwner(activities, userId), [activities, userId]);
}

export function useReviewsForVolunteer(userId?: string): OldReview[] {
    return useUserReviews(userId);
}
