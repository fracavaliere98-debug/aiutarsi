import { useMemo } from "react";
import { AppUser, Badge } from "../../types";
import { useGamificationStateQuery } from "./queries";
import { GamificationState } from "./types";
import { deriveGamificationView } from "./logic";

const EMPTY_BADGES: Badge[] = [];
const EMPTY_STATE: GamificationState = {
    totalXP: 0,
    level: 1,
    badges: EMPTY_BADGES,
    completedActivitiesCount: 0,
    processedActivityIds: [],
    sharedActivities: [],
    enrolledNPOs: [],
    claimedMilestones: [],
    followedNPOsHistory: [],
    totalHours: 0,
    completedCategories: [],
    completionDates: [],
    reviewedNpoIds: [],
};

export function useGamificationView(user?: AppUser | null) {
    const query = useGamificationStateQuery(user);
    const state = query.data ?? EMPTY_STATE;
    const derived = useMemo(() => deriveGamificationView(state), [state]);

    return {
        state,
        ...derived,
        isLoading: query.isLoading || query.isFetching,
        refetch: query.refetch,
    };
}
