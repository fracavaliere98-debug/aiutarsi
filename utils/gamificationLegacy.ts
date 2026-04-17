import { AppUser, Badge } from "../types";
import { GamificationState } from "../hooks/gamification/types";

// Legacy profile-side snapshot adapter.
// This is a temporary safety net only. Canonical selectors must not use these fields directly.
export function getLegacyGamificationSnapshot(userId: string, fallbackUser?: AppUser | null): GamificationState {
    const totalXP = fallbackUser?.xp ?? fallbackUser?.impactPoints ?? fallbackUser?.impact_points ?? 0;
    const level = Math.max(1, Math.floor(totalXP < 110 ? 1 :
        totalXP < 450 ? 2 :
        totalXP < 1000 ? 3 :
        totalXP < 2000 ? 4 :
        totalXP < 3500 ? 5 :
        totalXP < 5500 ? 6 :
        totalXP < 8000 ? 7 :
        totalXP < 11000 ? 8 :
        totalXP < 15000 ? 9 :
        10 + Math.floor((totalXP - 15000) / 5000)
    ));

    return {
        totalXP,
        level,
        badges: (fallbackUser?.badges as Badge[]) || [],
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
}
