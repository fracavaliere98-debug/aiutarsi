import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { AppState } from "react-native";
import { Activity, Review, ActivityApplication, VolunteerReview } from "../types";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";
import { useGamification } from "./GamificationContext";
import { activityService } from "../services/ActivityService";
import { eventEmitter, SyncEvents } from "../utils/EventEmitter";
import { calculateSmartMatch } from "../utils/SmartMatch";

export interface VolunteerStats {
    totalHours: number;
    completedMissions: number;
    activeMissions: number;
    upcomingMissions: number;
}

interface ActivityContextType {
    activities: Activity[];
    reviews: Review[];
    userActivities: Activity[];
    userReviews: Review[];
    recommendedActivities: Activity[];
    volunteerReviews: VolunteerReview[]; // Added
    activityApplications: ActivityApplication[]; // All applications
    volunteerStats: VolunteerStats; // New stats object
    enrollInActivity: (activityId: string, message?: string, phone?: string) => Promise<boolean>;
    unenrollFromActivity: (activityId: string) => Promise<boolean>;
    applyToActivity: (activityId: string, message?: string, phone?: string) => Promise<boolean>;
    createActivity: (activityData: Omit<Activity, "id" | "iscritti" | "npoId" | "npoName" | "status" | "matchPercentage"> & { skills: string[] }) => Promise<string | null>;
    submitReview: (reviewData: Omit<Review, "id" | "volunteerId" | "date">) => Promise<boolean>;
    submitVolunteerReviews: (reviewsData: Omit<VolunteerReview, 'id' | 'date'>[]) => Promise<void>; // Added
    updateActivity: (activityId: string, activityData: Partial<Activity>) => Promise<boolean>;
    getNPORating: (npoId: string) => number;
    deleteActivity: (activityId: string) => Promise<boolean>;
    approveActivityApplication: (activityId: string, volunteerId: string) => Promise<boolean>;
    rejectActivityApplication: (activityId: string, volunteerId: string) => Promise<boolean>;
    resetData: () => Promise<void>; // Debug function
    error: boolean;
    loadData: () => Promise<void>;
    // Pagination & Search
    paginatedActivities: Activity[];
    hasMore: boolean;
    isLoadingMore: boolean;
    fetchPaginatedActivities: (params: {
        reset?: boolean;
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
    }) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType>({
    activities: [],
    reviews: [],
    userActivities: [],
    userReviews: [],
    recommendedActivities: [],
    volunteerReviews: [], // Added
    activityApplications: [],
    volunteerStats: { totalHours: 0, completedMissions: 0, activeMissions: 0, upcomingMissions: 0 },
    enrollInActivity: async () => false,
    unenrollFromActivity: async () => false,
    applyToActivity: async () => false,
    createActivity: async () => null,
    submitReview: async () => false,
    submitVolunteerReviews: async () => { }, // Added
    updateActivity: async () => false,
    getNPORating: () => 0,
    deleteActivity: async () => false,
    approveActivityApplication: async () => false,
    rejectActivityApplication: async () => false,
    resetData: async () => { },
    error: false,
    loadData: async () => { },
    paginatedActivities: [],
    hasMore: false,
    isLoadingMore: false,
    fetchPaginatedActivities: async () => { },
});

export const useActivities = () => useContext(ActivityContext);

function ActivityProviderInner({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const [rawActivities, setRawActivities] = useState<Activity[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [volunteerReviews, setVolunteerReviews] = useState<VolunteerReview[]>([]); // Added
    const [activityApplications, setActivityApplications] = useState<ActivityApplication[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [error, setError] = useState(false);

    // Pagination State
    const [pageRawActivities, setPageRawActivities] = useState<Activity[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [currentCategory, setCurrentCategory] = useState<string>("Tutti");
    const [currentSearch, setCurrentSearch] = useState<string>("");

    const abortControllerRef = React.useRef<AbortController | null>(null);

    // Dynamic Activity Processing (Smart Match) - Global
    const activities = useMemo(() => {
        return rawActivities.map(act => ({
            ...act,
            matchPercentage: calculateSmartMatch(user, act)
        }));
    }, [rawActivities, user]);

    // Dynamic Activity Processing (Smart Match) - Paginated
    const paginatedActivities = useMemo(() => {
        return pageRawActivities.map(act => ({
            ...act,
            matchPercentage: calculateSmartMatch(user, act)
        }));
    }, [pageRawActivities, user]);

    // Calculate Volunteer Stats
    const volunteerStats = useMemo(() => {
        if (!user || user.role !== 'VOLUNTEER') {
            return { totalHours: 0, completedMissions: 0, activeMissions: 0, upcomingMissions: 0 };
        }

        const myActivities = activities.filter(a => a.iscritti.includes(user.id));

        const completed = myActivities.filter(a => a.status === 'COMPLETATA');
        const active = myActivities.filter(a => a.status === 'IN_CORSO');
        const upcoming = myActivities.filter(a => a.status === 'APERTA');

        // Calculate total hours
        const hours = completed.reduce((acc, curr) => {
            const start = new Date(curr.dateTime).getTime();
            const end = new Date(curr.endDateTime).getTime();
            const durationMs = end - start;
            const durationHours = durationMs / (1000 * 60 * 60);
            return acc + (isNaN(durationHours) ? 0 : durationHours);
        }, 0);

        return {
            totalHours: Math.round(hours),
            completedMissions: completed.length,
            activeMissions: active.length,
            upcomingMissions: upcoming.length
        };
    }, [activities, user]);

    const loadData = useCallback(async () => {
        setError(false);
        try {
            const [fetchedData, fetchedReviews, fetchedVolunteerReviews, fetchedApps] = await Promise.all([
                activityService.getActivities(),
                activityService.getReviews(),
                activityService.getVolunteerReviews(), // Fetched volunteer reviews
                activityService.getActivityApplications()
            ]);
            setRawActivities(fetchedData.activities);
            setReviews(fetchedReviews);
            setVolunteerReviews(fetchedVolunteerReviews); // Set volunteer reviews
            setActivityApplications(fetchedApps);
        } catch (error) {
            console.error("Failed to load activity data", error);
            setError(true);
        } finally {
            setIsInitialLoad(false);
        }
    }, []);

    const fetchPaginatedActivities = useCallback(async ({
        reset = false, category, searchText, skills, onlyAvailable, onlyUrgent, dateFrom, dateTo,
        centerLat, centerLng, radiusKm, statuses
    }: {
        reset?: boolean; category?: string; searchText?: string;
        skills?: string[]; onlyAvailable?: boolean; onlyUrgent?: boolean; dateFrom?: string; dateTo?: string;
        centerLat?: number; centerLng?: number; radiusKm?: number; statuses?: string[];
    }) => {
        setIsLoadingMore(true);
        setError(false);

        // Handle Race Condition: Abort previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const newOffset = reset ? 0 : offset;
            const targetCategory = category !== undefined ? category : currentCategory;
            const targetSearch = searchText !== undefined ? searchText : currentSearch;

            const result = await activityService.getActivities({
                category: targetCategory,
                searchText: targetSearch,
                offset: newOffset,
                limit: 15,
                skills,
                onlyUrgent,
                dateFrom,
                dateTo,
                centerLat,
                centerLng,
                radiusKm,
                statuses
            }, controller.signal);

            if (reset) {
                setPageRawActivities(result.activities);
                setOffset(result.activities.length);
            } else {
                // Deduplicate by ID to be safe
                setPageRawActivities(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    const uniqueNew = result.activities.filter(a => !existingIds.has(a.id));
                    return [...prev, ...uniqueNew];
                });
                setOffset(prev => prev + result.activities.length);
            }

            setHasMore(result.hasMore);
            if (category !== undefined) setCurrentCategory(category);
            if (searchText !== undefined) setCurrentSearch(searchText);

        } catch (err: any) {
            if (err.name === 'AbortError' || err.code === 'ABORTED') {
                console.log("Fetch aborted");
            } else {
                console.error("Fetch paginated activities failed", err);
                setError(true);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoadingMore(false);
                abortControllerRef.current = null;
            }
        }
    }, [offset, currentCategory, currentSearch]);

    // Load from Service on mount & Listen for Sync Events
    useEffect(() => {
        loadData();

        const unsubActivities = eventEmitter.on(SyncEvents.SYNC_ACTIVITIES, () => {
            console.log("ActivityContext: Syncing activities...");
            loadData();
        });

        const unsubReviews = eventEmitter.on(SyncEvents.SYNC_REVIEWS, () => {
            console.log("ActivityContext: Syncing reviews...");
            loadData();
        });

        const unsubApps = eventEmitter.on(SyncEvents.SYNC_APPLICATIONS, () => {
            console.log("ActivityContext: Syncing applications...");
            loadData();
        });

        return () => {
            unsubActivities();
            unsubReviews();
            unsubApps();
        };
    }, [loadData]);


    const refreshActivityStates = useCallback(async () => {
        try {
            const updatedActivities = await activityService.refreshActivityStates();
            setRawActivities(updatedActivities);
        } catch (error) {
            console.error("Refresh states failed", error);
        }
    }, []);

    useEffect(() => {
        if (isInitialLoad) return;
        refreshActivityStates();

        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") {
                refreshActivityStates();
            }
        });

        return () => subscription.remove();
    }, [refreshActivityStates, isInitialLoad]);

    const { handleActivityCompletion, handleReviewSubmission, isLoaded: gamificationLoaded } = useGamification();

    useEffect(() => {
        if (!user || user.role !== "VOLUNTEER" || !gamificationLoaded) return;
        activities.forEach(act => {
            if (act.status === "COMPLETATA" && act.iscritti.includes(user.id)) {
                handleActivityCompletion(act);
            }
        });
    }, [activities, user, handleActivityCompletion, gamificationLoaded]);

    const createActivity = useCallback(async (activityData: Omit<Activity, "id" | "iscritti" | "npoId" | "npoName" | "status" | "matchPercentage"> & { skills: string[] }): Promise<string | null> => {
        if (!user || user.role !== "NPO") return null;
        try {
            const newActivity = await activityService.createActivity({
                ...activityData,
                npoId: user.id,
                npoName: user.npoName || "Ente Solidale",
                status: "APERTA",
                iscritti: [],
                matchPercentage: 0,
                skills: activityData.skills || [],
            });
            return newActivity.id;
        } catch (error) {
            console.error("Create activity failed:", error);
            return null;
        }
    }, [user]);

    const enrollInActivity = useCallback(async (activityId: string, message?: string, phone?: string): Promise<boolean> => {
        if (!user || user.role !== "VOLUNTEER") return false;
        try {
            const updatedActivity = await activityService.joinActivity(activityId, user.id, message, phone);

            // LOCAL UPDATE (aggiornamento locale per rendering immediato UI)
            setRawActivities(prev => prev.map(a => {
                if (a.id === activityId) {
                    const newIscritti = new Set([...a.iscritti, user.id]);
                    return { ...a, iscritti: Array.from(newIscritti) };
                }
                return a;
            }));
            setPageRawActivities(prev => prev.map(a => {
                if (a.id === activityId) {
                    const newIscritti = new Set([...a.iscritti, user.id]);
                    return { ...a, iscritti: Array.from(newIscritti) };
                }
                return a;
            }));

            addNotification({
                userId: updatedActivity.npoId,
                type: "VOLUNTEER_ENROLLED",
                title: "Nuovo Volontario Iscritto! 🎉",
                message: message ? `${user.name} si è iscritto: "${message}"` : `${user.name} si è iscritto all'attività "${updatedActivity.title}"`,
                activityId: activityId,
            });
            return true;
        } catch (error) {
            console.error("Enroll in activity failed:", error);
            return false;
        }
    }, [user, addNotification]);

    const unenrollFromActivity = useCallback(async (activityId: string): Promise<boolean> => {
        if (!user || user.role !== "VOLUNTEER") return false;
        try {
            await activityService.withdrawApplication(activityId, user.id);

            // LOCAL UPDATE (aggiornamento locale per rendering immediato UI)
            setRawActivities(prev => prev.map(a => {
                if (a.id === activityId) {
                    return { ...a, iscritti: a.iscritti.filter(id => id !== user.id) };
                }
                return a;
            }));
            setPageRawActivities(prev => prev.map(a => {
                if (a.id === activityId) {
                    return { ...a, iscritti: a.iscritti.filter(id => id !== user.id) };
                }
                return a;
            }));

            // ALSO FORCE update applications immediately locally to prevent `userActivities` from restoring dead associations
            setActivityApplications(prev => prev.filter(app => !(app.activityId === activityId && app.volunteerId === user.id)));

            addNotification({
                userId: user.id,
                type: "INFO",
                title: "Iscrizione annullata",
                message: "La tua iscrizione è stata annullata con successo.",
                activityId: activityId,
            });
            // Force refresh of data
            await loadData();
            // Fire Sync event to make sure other subscribed components (like ActivityDetail fallbacks) catch it
            eventEmitter.emit(SyncEvents.SYNC_ACTIVITIES);
            eventEmitter.emit(SyncEvents.SYNC_APPLICATIONS);
            return true;
        } catch (error) {
            console.error("Unenroll from activity failed:", error);
            return false;
        }
    }, [user, addNotification, loadData]);

    const applyToActivity = useCallback(async (activityId: string, message?: string, phone?: string): Promise<boolean> => {
        if (!user) return false;
        try {
            const appData: Omit<ActivityApplication, "id"> = {
                activityId,
                volunteerId: user.id,
                volunteerName: user.name,
                status: "PENDING",
                appliedDate: new Date().toISOString(),
                message
            };
            await activityService.submitActivityApplication(appData);
            return true;
        } catch (error) {
            return false;
        }
    }, [user]);

    const submitReview = useCallback(async (reviewData: Omit<Review, "id" | "volunteerId" | "date">): Promise<boolean> => {
        if (!user || user.role !== "VOLUNTEER") return false;
        try {
            await activityService.submitReview({
                ...reviewData,
                volunteerId: user.id,
                date: new Date().toISOString(),
            });

            // Trigger gamification
            handleReviewSubmission(reviewData.npoId);

            return true;
        } catch (error) {
            return false;
        }
    }, [user, handleReviewSubmission]);

    // --- Volunteer Reviews (NPO -> Volunteer) ---
    const submitVolunteerReviews = useCallback(async (reviewsData: Omit<VolunteerReview, 'id' | 'date'>[]) => {
        try {
            await activityService.submitVolunteerReviews(reviewsData);
            // Optionally, refresh data to show new reviews
            await loadData();
        } catch (error) {
            console.error("Failed to submit volunteer reviews", error);
            throw error;
        }
    }, [loadData]);

    const updateActivity = useCallback(async (activityId: string, activityData: Partial<Activity>): Promise<boolean> => {
        if (!user || user.role !== "NPO") return false;
        try {
            const currentActivity = activities.find(a => a.id === activityId);
            if (!currentActivity) return false;
            const updated = { ...currentActivity, ...activityData };
            await activityService.updateActivity(updated);

            // Refresh data to ensure all components see the update (especially images/status)
            await loadData();
            return true;
        } catch (error) {
            console.error("Update activity failed:", error);
            return false;
        }
    }, [user, activities, loadData]);

    const deleteActivity = useCallback(async (activityId: string): Promise<boolean> => {
        if (!user || user.role !== "NPO") return false;
        try {
            await activityService.deleteActivity(activityId);
            return true;
        } catch (error) {
            return false;
        }
    }, [user]);

    const approveActivityApplication = useCallback(async (activityId: string, volunteerId: string): Promise<boolean> => {
        if (!user || user.role !== "NPO") return false;
        try {
            await activityService.updateActivityApplicationStatus(activityId, volunteerId, 'APPROVED');

            // Send notification to volunteer
            const act = activities.find(a => a.id === activityId);
            addNotification({
                userId: volunteerId,
                type: "APPLICATION_APPROVED",
                title: "Iscrizione Approvata! 🎉",
                message: `La tua richiesta per "${act?.title || 'Attività'}" è stata accettata`,
                activityId
            });

            return true;
        } catch (error) {
            console.error("Approve activity application failed:", error);
            return false;
        }
    }, [user, activities, addNotification]);

    const rejectActivityApplication = useCallback(async (activityId: string, volunteerId: string): Promise<boolean> => {
        if (!user || user.role !== "NPO") return false;
        try {
            await activityService.updateActivityApplicationStatus(activityId, volunteerId, 'REJECTED');

            // Send notification to volunteer
            const act = activities.find(a => a.id === activityId);
            addNotification({
                userId: volunteerId,
                type: "APPLICATION_REJECTED",
                title: "Iscrizione Rifiutata",
                message: `La tua richiesta per "${act?.title || 'Attività'}" è stata rifiutata`,
                activityId
            });

            return true;
        } catch (error) {
            console.error("Reject activity application failed:", error);
            return false;
        }
    }, [user, activities, addNotification]);

    const getNPORating = useCallback((npoId: string): number => {
        const npoReviews = reviews.filter(r => r.npoId === npoId);
        if (npoReviews.length === 0) return 0;
        const sum = npoReviews.reduce((acc, r) => acc + r.stars, 0);
        return parseFloat((sum / npoReviews.length).toFixed(1));
    }, [reviews]);

    const userActivities = useMemo(() => {
        if (!user) return [];
        if (user.role === "VOLUNTEER") return activities.filter(act => act.iscritti.includes(user.id));
        if (user.role === "NPO") return activities.filter(act => act.npoId === user.id || act.npoName === user.npoName);
        return [];
    }, [activities, user]);

    const userReviews = useMemo(() => {
        if (!user || user.role !== "VOLUNTEER") return [];
        return reviews.filter(r => r.volunteerId === user.id);
    }, [reviews, user]);

    const recommendedActivities = useMemo(() => {
        if (!user || user.role !== "VOLUNTEER") return [];
        return activities
            .filter(act => (act.status === "APERTA" || act.status === "IN_CORSO") && !act.iscritti.includes(user.id))
            .map(act => ({ ...act, matchPercentage: 85 })) // Simplified match for reconstruction
            .sort((a, b) => b.matchPercentage - a.matchPercentage);
    }, [activities, user]);

    const resetData = useCallback(async () => {
        // No-op for now in Supabase mode
        console.warn("Reset data not supported in Supabase mode");
    }, []);

    const value = useMemo(() => ({
        activities,
        reviews,
        userActivities,
        userReviews,
        volunteerReviews,
        recommendedActivities,
        activityApplications,
        volunteerStats,
        enrollInActivity,
        unenrollFromActivity,
        applyToActivity,
        createActivity,
        submitReview,
        submitVolunteerReviews,
        updateActivity,
        getNPORating,
        deleteActivity,
        approveActivityApplication,
        rejectActivityApplication,
        resetData,
        error,
        loadData,
        paginatedActivities,
        hasMore,
        isLoadingMore,
        fetchPaginatedActivities
    }), [
        activities,
        reviews,
        userActivities,
        userReviews,
        volunteerReviews,
        recommendedActivities,
        activityApplications,
        volunteerStats,
        enrollInActivity,
        unenrollFromActivity,
        applyToActivity,
        createActivity,
        submitReview,
        submitVolunteerReviews,
        updateActivity,
        getNPORating,
        deleteActivity,
        approveActivityApplication,
        rejectActivityApplication,
        resetData,
        error,
        loadData,
        paginatedActivities,
        hasMore,
        isLoadingMore,
        fetchPaginatedActivities
    ]);

    return (
        <ActivityContext.Provider value={value}>
            {children}
        </ActivityContext.Provider>
    );
}

export const ActivityProvider = ({ children }: { children: React.ReactNode }) => {
    return <ActivityProviderInner>{children}</ActivityProviderInner>;
};
