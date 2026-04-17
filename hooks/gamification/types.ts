import { Badge } from "../../types";

export interface GamificationState {
    totalXP: number;
    level: number;
    badges: Badge[];
    completedActivitiesCount: number;
    processedActivityIds: string[];
    sharedActivities: string[];
    enrolledNPOs: string[];
    claimedMilestones: number[];
    followedNPOsHistory: string[];
    totalHours: number;
    completedCategories: string[];
    completionDates: string[];
    reviewedNpoIds: string[];
}

export interface GamificationDerivedView {
    levelName: string;
    currentLevelXP: number;
    nextLevelXP: number;
    xpInLevel: number;
    xpNeededForLevel: number;
    levelProgress: number;
}

export interface LevelUpData {
    level: number;
}
