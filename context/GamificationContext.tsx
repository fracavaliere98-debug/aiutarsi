import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { supabase } from "../utils/supabase";
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Badge {
    id: string;
    name: string;
    icon: string;
    description: string;
    dateEarned: string;
    color: string;
}

export interface GamificationState {
    totalXP: number;
    level: number;
    levelName?: string;
    completedActivities: string[];
    processedActivityIds: string[];
    completedActivitiesCount: number;
    sharedActivities: string[];
    enrolledNPOs: string[];
    claimedMilestones: number[];
    badges: Badge[];
    followedNPOsHistory: string[];
    initializedUsers: string[];
    totalHours: number;
    completedCategories: string[];
    completionDates: string[];
    reviewedNpoIds: string[];
}

const INITIAL_STATE: GamificationState = {
    totalXP: 0,
    level: 1,
    levelName: "Novizio",
    completedActivities: [],
    processedActivityIds: [],
    completedActivitiesCount: 0,
    sharedActivities: [],
    enrolledNPOs: [],
    claimedMilestones: [],
    badges: [],
    followedNPOsHistory: [],
    initializedUsers: [],
    totalHours: 0,
    completedCategories: [],
    completionDates: [],
    reviewedNpoIds: [],
};

// Leveling logic (same as DB)
export const getXPForNextLevel = (level: number): number => {
    switch (level) {
        case 1: return 110;
        case 2: return 450;
        case 3: return 1000;
        case 4: return 2000;
        case 5: return 3500;
        case 6: return 5500;
        case 7: return 8000;
        case 8: return 11000;
        case 9: return 15000;
        default: return 15000 + (level - 9) * 5000;
    }
};

export const getXPForCurrentLevel = (level: number): number => {
    if (level === 1) return 0;
    return getXPForNextLevel(level - 1);
};

interface GamificationContextType {
    state: GamificationState;
    levelProgress: number;
    nextLevelXP: number;
    currentLevelXP: number;
    handleActivityShare: (activityId: string) => void;
    levelUpData: { level: number } | null;
    dismissLevelUp: () => void;
    isLoaded: boolean;

    // Deprecated / Handled by Backend DB Triggers:
    // Left as no-ops to prevent immediate crashes in components mid-migration
    addXP: (amount: number, reason: string) => void;
    handleActivityCompletion: (activity: any) => void;
    handleFollowNPO: (npoId: string) => void;
    handleNPOEnrollment: (npoId: string) => void;
    handleReviewSubmission: (npoId: string) => void;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const getUserGamificationState = async (userId: string): Promise<GamificationState> => {
    try {
        const { data, error } = await supabase
            .from('gamification_state')
            .select(`
                *,
                levels:level (name)
            `)
            .eq('user_id', userId)
            .maybeSingle();

        if (data && !error) {
            return {
                totalXP: data.xp,
                level: data.level,
                levelName: data.levels?.name || "Sconosciuto",
                badges: data.badges as Badge[],
                completedActivitiesCount: data.completed_activities_count,
                processedActivityIds: data.processed_activity_ids || [],
                sharedActivities: data.shared_activity_ids || [],
                enrolledNPOs: data.enrolled_npo_ids || [],
                claimedMilestones: data.claimed_milestones || [],
                followedNPOsHistory: data.followed_npos_history || [],
                totalHours: data.total_hours || 0,
                completedCategories: data.completed_categories || [],
                completionDates: data.completion_dates || [],
                reviewedNpoIds: data.reviewed_npo_ids || [],
                completedActivities: data.processed_activity_ids || [],
                initializedUsers: [userId]
            };
        }
    } catch (e) {
        console.warn("Failed to load user gamification from DB", e);
    }
    return INITIAL_STATE;
};

export const GamificationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // 1. Fetch server state using React Query
    const { data, isFetching } = useQuery({
        queryKey: ['gamification', user?.id],
        enabled: !!user?.id,
        staleTime: 30_000,
        refetchInterval: 60_000, // Background poll every minute to catch backend trigger updates
        queryFn: () => getUserGamificationState(user!.id)
    });

    const state = data || INITIAL_STATE;

    // 2. Local State for Level Up Modal
    const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
    const prevLevelRef = useRef<number | null>(null);

    // Watch for Level Up
    useEffect(() => {
        const checkLevelUp = async () => {
            if (!data) return; // Wait for actual data from backend

            const currentLevel = data.level;

            // Load last seen level from AsyncStorage to survive app restarts
            const lastSeenLevelStr = await AsyncStorage.getItem(`last_seen_level_${user?.id}`);
            const lastSeenLevel = lastSeenLevelStr ? parseInt(lastSeenLevelStr, 10) : 0;

            if (prevLevelRef.current === null) {
                // First load of the app session
                // We sync the ref but DO NOT trigger the level up modal, unless it's genuinely
                // higher than what's in AsyncStorage (which shouldn't usually happen unless leveled up on another device)
                prevLevelRef.current = currentLevel;
                
                // If they leveled up while the app was closed/backgrounded or on another device
                if (currentLevel > lastSeenLevel && lastSeenLevel > 0) {
                     setLevelUpData({ level: currentLevel });
                     await AsyncStorage.setItem(`last_seen_level_${user?.id}`, currentLevel.toString());
                }
            } else if (currentLevel !== prevLevelRef.current) {
                // Level changed during active app session
                if (currentLevel > prevLevelRef.current && currentLevel > lastSeenLevel) {
                    setLevelUpData({ level: currentLevel });
                    await AsyncStorage.setItem(`last_seen_level_${user?.id}`, currentLevel.toString());
                }
                // Always sync the ref
                prevLevelRef.current = currentLevel;
            }
        };

        checkLevelUp();
    }, [data, user?.id]);

    const dismissLevelUp = useCallback(() => setLevelUpData(null), []);

    // 3. OldUser Actions (Client-Driven)
    const handleActivityShare = useCallback(async (activityId: string) => {
        if (!user) return;
        // Backend RPC handles the logic and checks array_append
        await supabase.rpc('record_activity_share', { p_activity_id: activityId });
        queryClient.invalidateQueries({ queryKey: ['gamification', user.id] });
    }, [user, queryClient]);

    // Derived parameters
    const nextLevelXP = getXPForNextLevel(state.level);
    const currentLevelXP = getXPForCurrentLevel(state.level);
    const levelProgress = Math.min(100, Math.max(0,
        ((state.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    ));

    return (
        <GamificationContext.Provider value={{
            state,
            levelProgress,
            nextLevelXP,
            currentLevelXP,
            levelUpData,
            dismissLevelUp,
            isLoaded: !isFetching,
            handleActivityShare,

            // Mocked NO-OPs since XP is granted by Postgres Triggers asynchronously
            addXP: () => { },
            handleActivityCompletion: () => { },
            handleFollowNPO: () => { },
            handleNPOEnrollment: () => { },
            handleReviewSubmission: () => { }
        }}>
            {children}
        </GamificationContext.Provider>
    );
};

export const useGamification = () => {
    const context = useContext(GamificationContext);
    if (!context) throw new Error("useGamification must be used within GamificationProvider");
    return context;
};
