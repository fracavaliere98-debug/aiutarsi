import { useQuery } from "@tanstack/react-query";
import { AppUser, Badge } from "../../types";
import { supabase } from "../../utils/supabase";
import { gamificationKeys } from "./keys";
import { GamificationState } from "./types";
import { getLegacyGamificationSnapshot } from "../../utils/gamificationLegacy";

export async function getUserGamificationState(userId: string, fallbackUser?: AppUser | null): Promise<GamificationState> {
    try {
        const { data, error } = await supabase
            .from("gamification_state")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (data && !error) {
            return {
                totalXP: data.xp ?? 0,
                level: data.level ?? 1,
                badges: ((data.badges as Badge[] | null) ?? []),
                completedActivitiesCount: data.completed_activities_count ?? 0,
                processedActivityIds: data.processed_activity_ids || [],
                sharedActivities: data.shared_activity_ids || [],
                enrolledNPOs: data.enrolled_npo_ids || [],
                claimedMilestones: data.claimed_milestones || [],
                followedNPOsHistory: data.followed_npos_history || [],
                totalHours: data.total_hours || 0,
                completedCategories: data.completed_categories || [],
                completionDates: data.completion_dates || [],
                reviewedNpoIds: data.reviewed_npo_ids || [],
            };
        }
    } catch (error) {
        console.warn("Failed to load user gamification from DB", error);
    }

    return getLegacyGamificationSnapshot(userId, fallbackUser);
}

export function useGamificationStateQuery(user?: AppUser | null, enabled = true) {
    return useQuery({
        queryKey: gamificationKeys.state(user?.id),
        queryFn: () => getUserGamificationState(user!.id, user),
        enabled: enabled && !!user?.id,
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
}
