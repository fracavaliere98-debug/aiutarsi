import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { Activity } from "../types";
import { supabase } from "../utils/supabase";

const STORAGE_KEY_GAMIFICATION = "@aiutarsi_gamification_v3";

interface GamificationState {
    totalXP: number;
    level: number;
    completedActivities: string[]; // IDs of activities where XP was already awarded (deprecated, use processedActivityIds)
    processedActivityIds: string[]; // IDs of activities where XP was already awarded
    completedActivitiesCount: number; // Count of completed activities for milestones
    sharedActivities: string[]; // IDs of activities that have been shared
    enrolledNPOs: string[]; // IDs of NPOs where user was accepted
    claimedMilestones: number[]; // 10, 20, 30... activities count
    badges: Badge[];
    followedNPOsHistory: string[]; // IDs of NPOs that have been followed (XP already awarded)
    initializedUsers: string[]; // Track user IDs that have been initialized (to prevent toast spam on re-login)
    totalHours: number;
    completedCategories: string[];
    completionDates: string[]; // ISO strings of when activities were completed
    reviewedNpoIds: string[];
}

export interface Badge {
    id: string;
    name: string;
    icon: string;
    description: string;
    dateEarned: string;
    color: string;
}

const INITIAL_STATE: GamificationState = {
    totalXP: 0,
    level: 1,
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

interface GamificationContextType {
    state: GamificationState;
    levelProgress: number; // 0-100 percentage to next level
    nextLevelXP: number;
    currentLevelXP: number; // XP needed for current level base
    addXP: (amount: number, reason: string) => void;
    handleActivityCompletion: (activity: Activity) => void;
    handleActivityShare: (activityId: string) => void;
    handleFollowNPO: (npoId: string) => void;
    handleNPOEnrollment: (npoId: string) => void;
    handleReviewSubmission: (npoId: string) => void;
    levelUpData: { level: number } | null;
    dismissLevelUp: () => void;
    isLoaded: boolean;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

// Leveling Curve: 110 * (Level ^ 2) - 110 (Simplified approximation of user requirements)
// Lv 1: 0
// Lv 2: 110
// Lv 3: 440 (User asked ~450)
// Lv 4: 990 (User asked ~1000)
// Lv 5: 1760 (User asked ~2000)
export const calculateLevelFromXP = (xp: number): number => {
    // Inverse of XP = 110 * (L-1)^2 ? No, user said 110 for Lv 1->2.
    // Let's use a lookup table for precision based on design doc
    // Lv 1: 0
    // Lv 2: 110
    // Lv 3: 450
    // Lv 4: 1000
    // Lv 5: 2000
    // Formula approximation: 110 * (Level-1)^1.8 ?
    // Let's stick to a manual curve for first 10 levels then linear/exp

    if (xp <= 0) return 1; // Safety check
    if (xp < 110) return 1;
    if (xp < 450) return 2;
    if (xp < 1000) return 3;
    if (xp < 2000) return 4;
    if (xp < 3500) return 5;
    if (xp < 5500) return 6;
    if (xp < 8000) return 7;
    if (xp < 11000) return 8; // ~Lv 10 is 10k
    if (xp < 15000) return 9;
    return Math.floor(10 + (xp - 15000) / 5000); // Fallback
};

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

export const GamificationProvider = ({ children }: { children: ReactNode }) => {
    const { user, updateUserProfile } = useAuth();
    const { showToast } = useToast();
    const [state, setState] = useState<GamificationState>(INITIAL_STATE);
    const [isLoaded, setIsLoaded] = useState(false);
    const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
    const prevLevelRef = React.useRef(1);

    // Session Cache to track follows in the current session (resets on app reload)
    const sessionUserCache = React.useRef<Map<string, string[]>>(new Map());



    // Load State from Supabase
    useEffect(() => {
        // RESET STATE ON LOGOUT (Critical for preventing data leak)
        if (!user) {
            console.log("[Gamification] User logout detected, resetting state.");
            setState(INITIAL_STATE); // Reset to base state
            setIsLoaded(false);
            prevLevelRef.current = 1;
            // Also clear session cache
            sessionUserCache.current.clear();
            return;
        }

        const load = async () => {
            try {
                console.log(`[Gamification] Loading state for ${user.id} from Supabase...`);
                // 1. TENTA IL CARICAMENTO DA SUPABASE
                const { data, error } = await supabase
                    .from('gamification_state')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (data && !error) {
                    const sbState: GamificationState = {
                        totalXP: data.xp,
                        level: data.level,
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
                        completedActivities: data.processed_activity_ids || [], // Backwards compatibility
                        initializedUsers: [user.id]
                    };
                    setState(sbState);
                    prevLevelRef.current = sbState.level;
                    console.log("[Gamification] State loaded from Supabase");
                } else {
                    // 2. FALLBACK A LOCAL STORAGE (MIGRAZIONE) SE DB VUOTO
                    console.log("[Gamification] No DB record, checking legacy AsyncStorage...");
                    const stored = await AsyncStorage.getItem(`${STORAGE_KEY_GAMIFICATION}_${user.id}`);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        setState(parsed);
                        prevLevelRef.current = parsed.level;
                        // Trigger immediate sync to DB
                        console.log("[Gamification] Found legacy state, migrating to DB...");
                    } else {
                        setState(INITIAL_STATE);
                        prevLevelRef.current = 1;
                    }
                }
            } catch (e) {
                console.error("Failed to load gamification", e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, [user?.id]); // CRITICAL FIX: Only reload if ID changes (login/switch), NOT on every profile update

    // Save State to Supabase (and local cache)
    useEffect(() => {
        if (!isLoaded || !user) return;

        const saveToDb = async () => {
            const payload = {
                user_id: user.id,
                xp: state.totalXP,
                level: state.level,
                badges: state.badges,
                completed_activities_count: state.completedActivitiesCount,
                processed_activity_ids: state.processedActivityIds,
                shared_activity_ids: state.sharedActivities,
                enrolled_npo_ids: state.enrolledNPOs,
                claimed_milestones: state.claimedMilestones,
                followed_npos_history: state.followedNPOsHistory,
                total_hours: state.totalHours,
                completed_categories: state.completedCategories,
                completion_dates: state.completionDates,
                reviewed_npo_ids: state.reviewedNpoIds,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('gamification_state')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) {
                if (error.code === '23503') {
                    console.warn("[Gamification] Profile not yet available (FK Violation). Retrying in 5s...");
                    // This is expected if AuthService hasn't finished ensuring profile existence
                    // The next debounce cycle will catch it.
                } else {
                    console.error("[Gamification] Failed to save to Supabase:", error.message);
                }
            }
            else {
                // Also cache locally for fast-offline launch if needed
                AsyncStorage.setItem(`${STORAGE_KEY_GAMIFICATION}_${user.id}`, JSON.stringify(state))
                    .catch(() => { });
            }
        };

        const timer = setTimeout(saveToDb, 1000); // Debounce saves
        return () => clearTimeout(timer);
    }, [state, isLoaded, user]);

    // Watch for Level Up
    useEffect(() => {
        if (!isLoaded) return;

        if (state.level > prevLevelRef.current) {
            setLevelUpData({ level: state.level });
        }
        prevLevelRef.current = state.level;
    }, [state.level, isLoaded]);

    const dismissLevelUp = useCallback(() => {
        setLevelUpData(null);
    }, []);

    const addXP = useCallback((amount: number, reason: string, showToastParam: boolean = true) => {
        if (!isLoaded) return; // Silent during load
        if (showToastParam) {
            showToast("success", `+${amount} XP: ${reason}`);
        }

        setState(prev => {
            const newXP = prev.totalXP + amount;
            const newLevel = calculateLevelFromXP(newXP);

            // Side effect (updateUserProfile) moved to a dedicated useEffect 
            // to comply with React's purity rules and avoid nested update warnings.

            return {
                ...prev,
                totalXP: newXP,
                level: newLevel
            };
        });
    }, [showToast]);

    // Side Effect: Sync XP to Auth Profile whenever it changes
    useEffect(() => {
        if (!isLoaded || !user || state.totalXP === 0) return;

        // Only update if there's a difference to avoid infinite loops
        if (user.impactPoints !== state.totalXP) {
            console.log(`[Gamification] Syncing XP to Profile: ${state.totalXP}`);
            updateUserProfile({ impactPoints: state.totalXP }).catch(err => {
                console.warn("[Gamification] Profile sync failed", err);
            });
        }
    }, [state.totalXP, user?.impactPoints, isLoaded, updateUserProfile]);

    // RE-IMPLEMENTING addXP to be safe with closure
    // We need to use a ref or ensure we have fresh state if we want to call external hooks with new values.
    // Or just put the logic inside the setState callback? No, side effects in setState are bad.

    // Better implementation:


    const handleActivityCompletion = useCallback((activity: Activity) => {
        if (!isLoaded || state.processedActivityIds.includes(activity.id)) return;

        let xp = 100;
        const start = new Date(activity.dateTime).getTime();
        const end = new Date(activity.endDateTime).getTime();
        const durationHours = (end - start) / (1000 * 60 * 60);

        if (durationHours > 6) xp = 200;
        else if (durationHours > 3) xp = 150;

        // Update count for milestones
        setState(prev => {
            const newCount = prev.completedActivitiesCount + 1;
            let bonusXP = 0;
            const newClaimed = [...prev.claimedMilestones];

            // Check every 10 activities
            if (newCount % 10 === 0 && !newClaimed.includes(newCount)) {
                bonusXP = 1000;
                newClaimed.push(newCount);
                setTimeout(() => showToast("success", "🏆 BONUS 1000 XP: 10 Attività Completate!"), 1000);
            }

            // BADGES CHECK
            const newBadges = [...prev.badges];

            // 1. Debuttante (First Activity)
            if (newCount === 1 && !newBadges.find(b => b.id === "debt")) {
                newBadges.push({
                    id: "debt", name: "Debuttante", icon: "🌱", description: "Hai completato la tua prima attività!", dateEarned: new Date().toISOString(), color: "bg-green-100"
                });
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Debuttante"), 2000);
            }

            // 2. Pilastro (10 Activities)
            if (newCount === 10 && !newBadges.find(b => b.id === "pila")) {
                newBadges.push({
                    id: "pila", name: "Pilastro", icon: "🏛️", description: "Hai completato 10 attività. Solido come una roccia.", dateEarned: new Date().toISOString(), color: "bg-blue-100"
                });
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Pilastro"), 2500);
            }

            // 3. Stacanovista (> 6 hours)
            if (durationHours > 6 && !newBadges.find(b => b.id === "stac")) {
                newBadges.push({
                    id: "stac", name: "Stacanovista", icon: "🏎️", description: "Hai partecipato a una maratona di volontariato (>6h). Wow!", dateEarned: new Date().toISOString(), color: "bg-red-100"
                });
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Stacanovista"), 2000);
            }

            // 6. Tuttofare (3 categories)
            const newCategories = prev.completedCategories.includes(activity.category)
                ? prev.completedCategories
                : [...prev.completedCategories, activity.category];

            if (newCategories.length === 3 && !newBadges.find(b => b.id === "tutt")) {
                newBadges.push({
                    id: "tutt", name: "Tuttofare", icon: "🛠️", description: "Partecipato ad attività in 3 categorie diverse.", dateEarned: new Date().toISOString(), color: "bg-orange-100"
                });
                bonusXP += 300;
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Tuttofare (+300 XP)"), 3000);
            }

            // 7. Fedelissimo (4 consecutive weeks)
            const today = new Date();
            const newDates = [...prev.completionDates, today.toISOString()];

            // Logic to check 4 consecutive weeks
            const weeksWithActivity = new Set();
            newDates.forEach(d => {
                const date = new Date(d);
                const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
                weeksWithActivity.add(weekNum);
            });

            const sortedWeeks = Array.from(weeksWithActivity).sort((a: any, b: any) => b - a);
            let consecutive = 1;
            for (let i = 0; i < sortedWeeks.length - 1; i++) {
                if ((sortedWeeks[i] as number) - (sortedWeeks[i + 1] as number) === 1) {
                    consecutive++;
                    if (consecutive >= 4) break;
                } else {
                    consecutive = 1;
                }
            }

            if (consecutive >= 4 && !newBadges.find(b => b.id === "fede")) {
                newBadges.push({
                    id: "fede", name: "Fedelissimo", icon: "🗓️", description: "Volontariato per 4 settimane consecutive. Costanza incredibile!", dateEarned: today.toISOString(), color: "bg-teal-100"
                });
                bonusXP += 600;
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Fedelissimo (+600 XP)"), 3500);
            }

            // 8. Veterano (100 hours)
            const newTotalHours = prev.totalHours + durationHours;
            if (newTotalHours >= 100 && !newBadges.find(b => b.id === "vete")) {
                newBadges.push({
                    id: "vete", name: "Veterano", icon: "🏅", description: "Hai superato le 100 ore di volontariato. Un vero leader.", dateEarned: today.toISOString(), color: "bg-yellow-100"
                });
                bonusXP += 1000;
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Veterano (+1000 XP)"), 4000);
            }

            // 10. Gufo Notturno (Night activity)
            const hour = new Date(activity.dateTime).getHours();
            if ((hour >= 20 || hour <= 7) && !newBadges.find(b => b.id === "gufo")) {
                newBadges.push({
                    id: "gufo", name: "Gufo Notturno", icon: "🦉", description: "Attività svolta in orario serale/notturno. Il buio non ti spaventa!", dateEarned: today.toISOString(), color: "bg-indigo-100"
                });
                bonusXP += 350;
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Gufo Notturno (+350 XP)"), 4500);
            }

            return {
                ...prev,
                completedActivitiesCount: newCount,
                processedActivityIds: [...prev.processedActivityIds, activity.id],
                claimedMilestones: newClaimed,
                badges: newBadges,
                totalHours: newTotalHours,
                completedCategories: newCategories,
                completionDates: newDates
            };
        });

        addXP(xp, "Attività Completata");

        // Handle Bonus XP separately to ensure state updates correctly
        // We can't access the *new* state immediately here due to closure
        // So strict logic: just check if (currentCount + 1) % 10 === 0
        if ((state.completedActivitiesCount + 1) % 10 === 0) {
            addXP(1000, "Milestone 10 Attività");
        }

    }, [addXP, state.completedActivitiesCount, showToast]);

    const handleActivityShare = useCallback((activityId: string) => {
        if (!isLoaded) return;
        if (state.sharedActivities.includes(activityId)) {
            showToast("info", "Hai già ricevuto punti per questa condivisione");
            return;
        }

        setState(prev => {
            const newShared = [...prev.sharedActivities, activityId];
            const newBadges = [...prev.badges];

            // 4. Voce del Popolo (10 Shares)
            if (newShared.length === 10 && !newBadges.find(b => b.id === "voce")) {
                newBadges.push({
                    id: "voce", name: "Voce del Popolo", icon: "📢", description: "Hai condiviso 10 attività. Grazie per il passaparola!", dateEarned: new Date().toISOString(), color: "bg-yellow-100"
                });
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Voce del Popolo"), 1500);
            }

            return {
                ...prev,
                sharedActivities: newShared,
                badges: newBadges
            };
        });
        addXP(10, "Condivisione Attività");
    }, [state.sharedActivities, addXP, showToast]);

    const handleFollowNPO = useCallback((npoId: string) => {
        addXP(10, "NPO Seguito");
    }, [addXP]);

    const handleNPOEnrollment = useCallback((npoId: string) => {
        if (!isLoaded || state.enrolledNPOs.includes(npoId)) return;

        setState(prev => ({
            ...prev,
            enrolledNPOs: [...prev.enrolledNPOs, npoId]
        }));
        addXP(200, "Candidatura Accettata (Team)");
    }, [state.enrolledNPOs, addXP]);

    // Watch for Follows (Auto-award XP)
    // We use sessionUserCache to track follows per user for the current session
    // This ensures we properly handle user switching and app reloads without spamming toasts

    useEffect(() => {
        if (!isLoaded || !user) return;

        const currentFollowed = user.followedNPOs || [];

        // DEBUG LOGGING
        // console.log(`[Gamification] Checking Follows. User: ${user.id}, Count: ${currentFollowed.length}, CacheInit: ${sessionUserCache.current.has(user.id)}`);

        // Strict Check: If followedNPOs is undefined in the user object (data not fully loaded),
        // DO NOT initialize the cache yet. Wait for a valid array.
        // However, if it's truly empty [], that's a valid state.
        // We assume user.followedNPOs is undefined if not loaded.
        if (user.followedNPOs === undefined) return;

        // If this is the first time we're seeing this user in this session, set baseline
        if (!sessionUserCache.current.has(user.id)) {
            // console.log("[Gamification] Initializing Session Cache", currentFollowed);
            // 1. Initialize Cache
            sessionUserCache.current.set(user.id, currentFollowed);

            // 2. CHECK HISTORY (Safety Net)
            // If we have follows that aren't in history, add them now silently.
            // This fixes the "lost history" bug causing spam on restart.
            const missingFromHistory = currentFollowed.filter(id => !state.followedNPOsHistory.includes(id));

            if (missingFromHistory.length > 0) {
                console.log("Session Start: Backfilling missing follows to history", missingFromHistory);
                setState(prev => ({
                    ...prev,
                    followedNPOsHistory: [...prev.followedNPOsHistory, ...missingFromHistory]
                }));
            }

            return; // Exit without awarding XP
        }

        // Get previous follows for this specific user from cache
        const prevFollowed = sessionUserCache.current.get(user.id) || [];

        // Find newly followed IDs
        const newFollowed = currentFollowed.filter(id =>
            !prevFollowed.includes(id) && !state.followedNPOsHistory.includes(id)
        );

        if (newFollowed.length > 0) {

            // Award XP for each new follow
            newFollowed.forEach(id => {
                console.log("[Gamification] Awarding XP for follow:", id);
                handleFollowNPO(id);
            });

            // Add to history
            setState(prev => ({
                ...prev,
                followedNPOsHistory: [...prev.followedNPOsHistory, ...newFollowed]
            }));

            // Trigger Networker Check
            if (state.followedNPOsHistory.length + newFollowed.length >= 5 && !state.badges.find(b => b.id === "netw")) {
                setState(prev => {
                    if (prev.badges.find(b => b.id === "netw")) return prev;
                    return {
                        ...prev,
                        badges: [...prev.badges, {
                            id: "netw", name: "Networker", icon: "🤝", description: "Segui 5 NPO", dateEarned: new Date().toISOString(), color: "bg-purple-100"
                        }]
                    };
                });
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Networker"), 2000);
            }
        }

        // Update cache
        sessionUserCache.current.set(user.id, currentFollowed);
    }, [user?.followedNPOs, isLoaded, handleFollowNPO, state.badges.length, showToast, state.followedNPOsHistory]);

    const nextLevelXP = getXPForNextLevel(state.level);
    const currentLevelXP = getXPForCurrentLevel(state.level);
    const levelProgress = Math.min(100, Math.max(0,
        ((state.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    ));

    const handleReviewSubmission = useCallback((npoId: string) => {
        if (!isLoaded) return;

        setState(prev => {
            if (prev.reviewedNpoIds.includes(npoId)) return prev;

            const newReviewed = [...prev.reviewedNpoIds, npoId];
            const newBadges = [...prev.badges];
            let bonusXP = 0;

            if (newReviewed.length === 5 && !newBadges.find(b => b.id === "rece")) {
                newBadges.push({
                    id: "rece", name: "Recensore d'Oro", icon: "🌟", description: "Hai lasciato 5 recensioni costruttive. La tua opinione conta!", dateEarned: new Date().toISOString(), color: "bg-yellow-50"
                });
                bonusXP = 150;
                setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Recensore d'Oro (+150 XP)"), 1500);
            }

            if (bonusXP > 0) {
                setTimeout(() => addXP(bonusXP, "Badge Recensore d'Oro"), 500);
            }

            return {
                ...prev,
                reviewedNpoIds: newReviewed,
                badges: newBadges
            };
        });
    }, [isLoaded, showToast, addXP]);

    // 9. Anniversario (1 year)
    useEffect(() => {
        if (!isLoaded || !user || !user.createdAt) return;

        const regDate = new Date(user.createdAt);
        const now = new Date();
        const diffYears = now.getFullYear() - regDate.getFullYear();
        const oneYearReached = diffYears >= 1 && now.getTime() >= new Date(regDate.getTime()).setFullYear(regDate.getFullYear() + 1);

        if (oneYearReached && !state.badges.find(b => b.id === "anni")) {
            setState(prev => {
                if (prev.badges.find(b => b.id === "anni")) return prev;
                return {
                    ...prev,
                    badges: [...prev.badges, {
                        id: "anni", name: "Anniversario", icon: "🎂", description: "Attivo nella community da un anno intero. Auguri!", dateEarned: new Date().toISOString(), color: "bg-pink-100"
                    }]
                };
            });
            addXP(1200, "Anniversario 1 Anno");
            setTimeout(() => showToast("success", "🏅 BADGE SBLOCCATO: Anniversario (+1200 XP)"), 2000);
        }
    }, [isLoaded, user?.createdAt, state.badges.length, addXP, showToast]);

    return (
        <GamificationContext.Provider value={{
            state,
            levelProgress,
            nextLevelXP,
            currentLevelXP,
            addXP,
            handleActivityCompletion,
            handleActivityShare,
            handleFollowNPO,
            handleNPOEnrollment,
            handleReviewSubmission,
            levelUpData,
            dismissLevelUp,
            isLoaded // Exposed for ApplicationContext sync
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

// Utility to fetch gamification state for any user (e.g. for NPO view)
export const getUserGamificationState = async (userId: string): Promise<GamificationState> => {
    try {
        const { data, error } = await supabase
            .from('gamification_state')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (data && !error) {
            return {
                totalXP: data.xp,
                level: data.level,
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
        console.error("Failed to load user gamification from DB", e);
    }
    return INITIAL_STATE;
};
