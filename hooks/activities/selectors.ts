import { useMemo } from "react";
import { AppActivity, AppUser, OldReview } from "../../types";
import {
    useActivitiesListQuery,
    useActivityApplicationsQuery,
    useActivityReviewsQuery,
} from "./queries";

export interface VolunteerStats {
    totalHours: number;
    completedMissions: number;
    activeMissions: number;
    upcomingMissions: number;
}

export function useActivitiesDomain(user?: AppUser | null) {
    const { data: activities = [], isError, refetch: refetchActivities } = useActivitiesListQuery(user?.id);
    const { data: reviews = [], refetch: refetchReviews } = useActivityReviewsQuery();
    const {
        data: activityApplications = [],
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

    return useMemo(() => {
        if (!user || user.role !== "VOLUNTEER") {
            return { totalHours: 0, completedMissions: 0, activeMissions: 0, upcomingMissions: 0 };
        }

        const myActivities = activities.filter((activity) => activity.iscritti.includes(user.id));
        const completed = myActivities.filter((activity) => activity.status === "COMPLETATA");
        const active = myActivities.filter((activity) => activity.status === "IN_CORSO");
        const upcoming = myActivities.filter((activity) => activity.status === "APERTA");
        const totalHours = completed.reduce((sum, activity) => {
            const start = new Date(activity.dateTime).getTime();
            const end = new Date(activity.endDateTime).getTime();
            const durationHours = (end - start) / (1000 * 60 * 60);
            return sum + (isNaN(durationHours) ? 0 : durationHours);
        }, 0);

        return {
            totalHours: Math.round(totalHours),
            completedMissions: completed.length,
            activeMissions: active.length,
            upcomingMissions: upcoming.length,
        };
    }, [activities, user]);
}

export function useUserReviews(userId?: string) {
    const { data: reviews = [] } = useActivityReviewsQuery();

    return useMemo(
        () => (userId ? reviews.filter((review) => review.volunteerId === userId) : []),
        [reviews, userId]
    );
}

export function useNPORating(npoId?: string) {
    const { data: reviews = [] } = useActivityReviewsQuery();

    return useMemo(() => {
        if (!npoId) return 0;
        const npoReviews = reviews.filter((review) => review.npoId === npoId);
        if (npoReviews.length === 0) return 0;
        const sum = npoReviews.reduce((acc, review) => acc + review.stars, 0);
        return parseFloat((sum / npoReviews.length).toFixed(1));
    }, [npoId, reviews]);
}

export function useActivitiesByOwner(userId?: string): AppActivity[] {
    const { activities = [] } = useActivitiesDomain(userId ? ({ id: userId } as AppUser) : undefined);
    return useMemo(() => (userId ? activities.filter((activity) => activity.npoId === userId) : []), [activities, userId]);
}

export function useReviewsForVolunteer(userId?: string): OldReview[] {
    return useUserReviews(userId);
}
