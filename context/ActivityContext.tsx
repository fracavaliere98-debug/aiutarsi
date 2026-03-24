import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { AppState } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppActivity, AppActivityApplication, OldReview, OldVolunteerReview } from "../types";
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
    activities: AppActivity[];
    reviews: OldReview[];
    userActivities: AppActivity[];
    userReviews: OldReview[];
    volunteerReviews: OldVolunteerReview[];
    activityApplications: AppActivityApplication[];
    volunteerStats: VolunteerStats;
    enrollInActivity: (activityId: string, message?: string, phone?: string) => Promise<boolean>;
    unenrollFromActivity: (activityId: string) => Promise<boolean>;
    applyToActivity: (activityId: string, message?: string, phone?: string) => Promise<boolean>;
    createActivity: (activityData: Omit<AppActivity, "id" | "iscritti" | "npoId" | "npoName" | "status" | "matchPercentage" | "profiles" | "activity_participants" | "activity_skills">) => Promise<string | null>;
    submitReview: (reviewData: Omit<OldReview, "id" | "volunteerId" | "date">) => Promise<boolean>;
    submitVolunteerReviews: (reviewsData: Omit<OldVolunteerReview, 'id' | 'date'>[]) => Promise<void>;
    updateActivity: (activityId: string, activityData: Partial<AppActivity>) => Promise<boolean>;
    getNPORating: (npoId: string) => number;
    deleteActivity: (activityId: string) => Promise<boolean>;
    approveActivityApplication: (activityId: string, volunteerId: string) => Promise<boolean>;
    rejectActivityApplication: (activityId: string, volunteerId: string) => Promise<boolean>;
    resetData: () => Promise<void>;
    error: boolean;
    loadData: () => Promise<void>;
    paginatedActivities: AppActivity[];
    hasMore: boolean;
    isLoadingMore: boolean;
    fetchPaginatedActivities: (params: {
        reset?: boolean; category?: string; searchText?: string; skills?: string[]; onlyAvailable?: boolean; onlyUrgent?: boolean; dateFrom?: string; dateTo?: string; centerLat?: number; centerLng?: number; radiusKm?: number; statuses?: string[];
    }) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType>({} as ActivityContextType);

export const useActivities = () => useContext(ActivityContext);

export function ActivityProviderInner({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { handleActivityCompletion, handleReviewSubmission, isLoaded: gamificationLoaded } = useGamification();
    const queryClient = useQueryClient();

    const [error, setError] = useState(false);

    // Queries
    const { data: rawActivities = [] } = useQuery({
        queryKey: ['activities_raw', user?.id],
        queryFn: async () => (await activityService.getActivities({ userId: user?.id })).activities,
        staleTime: 60_000
    });
    const { data: reviews = [] } = useQuery({ queryKey: ['reviews'], queryFn: () => activityService.getReviews(), staleTime: 60_000 });
    const { data: volunteerReviews = [] } = useQuery({ queryKey: ['volunteer_reviews'], queryFn: () => activityService.getVolunteerReviews(), staleTime: 60_000 });
    const { data: activityApplications = [] } = useQuery({ queryKey: ['activity_applications'], queryFn: () => activityService.getActivityApplications(), staleTime: 60_000 });

    const loadData = useCallback(async () => {
        setError(false);
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['activities_raw'] }),
                queryClient.invalidateQueries({ queryKey: ['reviews'] }),
                queryClient.invalidateQueries({ queryKey: ['volunteer_reviews'] }),
                queryClient.invalidateQueries({ queryKey: ['activity_applications'] })
            ]);
        } catch (error) { setError(true); }
    }, [queryClient]);

    // Check gamification completion based on activities changes
    useEffect(() => {
        if (!user || user.role !== "VOLUNTEER" || !gamificationLoaded) return;
        rawActivities.forEach(act => {
            if (act.status === "COMPLETATA" && act.iscritti.includes(user.id)) {
                handleActivityCompletion(act);
            }
        });
    }, [rawActivities, user, handleActivityCompletion, gamificationLoaded]);

    // Pagination State
    const [pageRawActivities, setPageRawActivities] = useState<AppActivity[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [currentCategory, setCurrentCategory] = useState<string>("Tutti");
    const [currentSearch, setCurrentSearch] = useState<string>("");
    const abortControllerRef = React.useRef<AbortController | null>(null);

    const activities = useMemo(() => rawActivities, [rawActivities]);
    const paginatedActivities = useMemo(() => pageRawActivities, [pageRawActivities]);

    const volunteerStats = useMemo(() => {
        if (!user || user.role !== 'VOLUNTEER') return { totalHours: 0, completedMissions: 0, activeMissions: 0, upcomingMissions: 0 };
        const myActivities = activities.filter(a => a.iscritti.includes(user.id));
        const completed = myActivities.filter(a => a.status === 'COMPLETATA');
        const active = myActivities.filter(a => a.status === 'IN_CORSO');
        const upcoming = myActivities.filter(a => a.status === 'APERTA');
        const hours = completed.reduce((acc, curr) => {
            const start = new Date(curr.dateTime).getTime();
            const end = new Date(curr.endDateTime).getTime();
            const durationMs = end - start;
            const durationHours = durationMs / (1000 * 60 * 60);
            return acc + (isNaN(durationHours) ? 0 : durationHours);
        }, 0);
        return { totalHours: Math.round(hours), completedMissions: completed.length, activeMissions: active.length, upcomingMissions: upcoming.length };
    }, [activities, user]);

    const fetchPaginatedActivities = useCallback(async (params: any) => {
        setIsLoadingMore(true);
        setError(false);
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const newOffset = params.reset ? 0 : offset;
            const targetCategory = params.category !== undefined ? params.category : currentCategory;
            const targetSearch = params.searchText !== undefined ? params.searchText : currentSearch;
            const result = await activityService.getActivities({ ...params, userId: user?.id, offset: newOffset, limit: 15, category: targetCategory, searchText: targetSearch }, controller.signal);
            if (params.reset) {
                setPageRawActivities(result.activities);
                setOffset(result.activities.length);
            } else {
                setPageRawActivities(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    const uniqueNew = result.activities.filter(a => !existingIds.has(a.id));
                    return [...prev, ...uniqueNew];
                });
                setOffset(prev => prev + result.activities.length);
            }
            setHasMore(result.hasMore);
            if (params.category !== undefined) setCurrentCategory(params.category);
            if (params.searchText !== undefined) setCurrentSearch(params.searchText);
        } catch (err: any) {
            if (err.name !== 'AbortError' && err.code !== 'ABORTED') setError(true);
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoadingMore(false);
                abortControllerRef.current = null;
            }
        }
    }, [offset, currentCategory, currentSearch]);

    // Listeners
    useEffect(() => {
        const unsubActivities = eventEmitter.on(SyncEvents.SYNC_ACTIVITIES, loadData);
        const unsubReviews = eventEmitter.on(SyncEvents.SYNC_REVIEWS, loadData);
        const unsubApps = eventEmitter.on(SyncEvents.SYNC_APPLICATIONS, loadData);
        return () => { unsubActivities(); unsubReviews(); unsubApps(); };
    }, [loadData]);

    // MUTATIONS
    const createMutation = useMutation({
        mutationFn: async (activityData: any) => {
            const newAct = await activityService.createActivity({
                ...activityData,
                npoId: user!.id,
                npoName: user!.npoName || "Ente Solidale",
                status: "APERTA",
                iscritti: [],
                matchPercentage: 0,
                skills: activityData.skills || [],
            });
            return newAct.id as string;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities_raw'] })
    });

    const enrollMutation = useMutation({
        mutationFn: async ({ activityId, message, phone }: any) => {
            const updated = await activityService.joinActivity(activityId, user!.id, message, phone);
            // Optimistic update
            queryClient.setQueryData(['activities_raw'], (old: AppActivity[]) => old ? old.map(a => a.id === activityId ? { ...a, iscritti: Array.from(new Set([...a.iscritti, user!.id])) } : a) : old);
            setPageRawActivities(prev => prev.map(a => a.id === activityId ? { ...a, iscritti: Array.from(new Set([...a.iscritti, user!.id])) } : a));
            addNotification({
                userId: updated.npoId || "",
                type: "VOLUNTEER_ENROLLED",
                title: "Nuovo Volontario Iscritto! 🎉",
                message: message ? `${user!.name} si è iscritto: "${message}"` : `${user!.name} si è iscritto all'attività "${updated.title}"`,
                activityId
            });
            return true;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities_raw'] })
    });

    const unenrollMutation = useMutation({
        mutationFn: async (activityId: string) => {
            await activityService.withdrawApplication(activityId, user!.id);
            // Optimistic update
            queryClient.setQueryData(['activities_raw'], (old: AppActivity[]) => old ? old.map(a => a.id === activityId ? { ...a, iscritti: a.iscritti.filter(id => id !== user!.id) } : a) : old);
            setPageRawActivities(prev => prev.map(a => a.id === activityId ? { ...a, iscritti: a.iscritti.filter(id => id !== user!.id) } : a));
            addNotification({ userId: user!.id, type: "INFO", title: "Iscrizione annullata", message: "La tua iscrizione è stata annullata con successo.", activityId });
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activities_raw'] });
            queryClient.invalidateQueries({ queryKey: ['activity_applications'] });
        }
    });

    const applyMutation = useMutation({
        mutationFn: async ({ activityId, message, phone }: any) => {
            await activityService.submitActivityApplication({ activityId, volunteerId: user!.id, volunteerName: user!.name, status: "PENDING", appliedDate: new Date().toISOString(), message });
            return true;
        },
    });

    const reviewMutation = useMutation({
        mutationFn: async (reviewData: any) => {
            await activityService.submitReview({ ...reviewData, volunteerId: user!.id, date: new Date().toISOString() });
            handleReviewSubmission(reviewData.npoId);
            return true;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] })
    });

    const volunteerReviewsMutation = useMutation({
        mutationFn: async (reviewsData: any) => {
            await activityService.submitVolunteerReviews(reviewsData);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['volunteer_reviews'] })
    });

    const updateMutation = useMutation({
        mutationFn: async ({ activityId, activityData }: any) => {
            const act = rawActivities.find(a => a.id === activityId);
            if (!act) return false;
            await activityService.updateActivity({ ...act, ...activityData });
            return true;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities_raw'] })
    });

    const deleteMutation = useMutation({
        mutationFn: async (activityId: string) => {
            await activityService.deleteActivity(activityId);
            return true;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities_raw'] })
    });

    const approveMutation = useMutation({
        mutationFn: async ({ activityId, volunteerId }: any) => {
            await activityService.updateActivityApplicationStatus(activityId, volunteerId, 'APPROVED');
            const act = rawActivities.find(a => a.id === activityId);
            addNotification({ userId: volunteerId, type: "APPLICATION_APPROVED", title: "Iscrizione Approvata! 🎉", message: `La tua richiesta per "${act?.title || 'Attività'}" è stata accettata`, activityId });
            return true;
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ activityId, volunteerId }: any) => {
            await activityService.updateActivityApplicationStatus(activityId, volunteerId, 'REJECTED');
            const act = rawActivities.find(a => a.id === activityId);
            addNotification({ userId: volunteerId, type: "APPLICATION_REJECTED", title: "Iscrizione Rifiutata", message: `La tua richiesta per "${act?.title || 'Attività'}" è stata rifiutata`, activityId });
            return true;
        },
    });

    // Callback Wrappers
    const createActivity = useCallback(async (activityData: any) => { if (user?.role !== 'NPO') return null; try { return await createMutation.mutateAsync(activityData); } catch { return null; } }, [user, createMutation]);
    const enrollInActivity = useCallback(async (activityId: string, message?: string, phone?: string) => { if (user?.role !== 'VOLUNTEER') return false; try { return await enrollMutation.mutateAsync({ activityId, message, phone }); } catch { return false; } }, [user, enrollMutation]);
    const unenrollFromActivity = useCallback(async (activityId: string) => { if (user?.role !== 'VOLUNTEER') return false; try { return await unenrollMutation.mutateAsync(activityId); } catch { return false; } }, [user, unenrollMutation]);
    const applyToActivity = useCallback(async (activityId: string, message?: string, phone?: string) => { if (!user) return false; try { return await applyMutation.mutateAsync({ activityId, message, phone }); } catch { return false; } }, [user, applyMutation]);
    const submitReview = useCallback(async (reviewData: any) => { if (user?.role !== 'VOLUNTEER') return false; try { return await reviewMutation.mutateAsync(reviewData); } catch { return false; } }, [user, reviewMutation]);
    const submitVolunteerReviews = useCallback(async (reviewsData: any) => { try { await volunteerReviewsMutation.mutateAsync(reviewsData); } catch (error) { throw error; } }, [volunteerReviewsMutation]);
    const updateActivity = useCallback(async (activityId: string, activityData: any) => { if (user?.role !== 'NPO') return false; try { return await updateMutation.mutateAsync({ activityId, activityData }); } catch { return false; } }, [user, updateMutation]);
    const deleteActivity = useCallback(async (activityId: string) => { if (user?.role !== 'NPO') return false; try { return await deleteMutation.mutateAsync(activityId); } catch { return false; } }, [user, deleteMutation]);
    const approveActivityApplication = useCallback(async (activityId: string, volunteerId: string) => { if (user?.role !== 'NPO') return false; try { return await approveMutation.mutateAsync({ activityId, volunteerId }); } catch { return false; } }, [user, approveMutation]);
    const rejectActivityApplication = useCallback(async (activityId: string, volunteerId: string) => { if (user?.role !== 'NPO') return false; try { return await rejectMutation.mutateAsync({ activityId, volunteerId }); } catch { return false; } }, [user, rejectMutation]);

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

    const userReviews = useMemo(() => (!user || user.role !== "VOLUNTEER") ? [] : reviews.filter(r => r.volunteerId === user.id), [reviews, user]);

    const resetData = useCallback(async () => { console.warn("Reset not supported"); }, []);

    const value = useMemo(() => ({
        activities, reviews, userActivities, userReviews, volunteerReviews, activityApplications, volunteerStats,
        enrollInActivity, unenrollFromActivity, applyToActivity, createActivity, submitReview, submitVolunteerReviews, updateActivity, getNPORating, deleteActivity, approveActivityApplication, rejectActivityApplication, resetData, error, loadData, paginatedActivities, hasMore, isLoadingMore, fetchPaginatedActivities
    }), [activities, reviews, userActivities, userReviews, volunteerReviews, activityApplications, volunteerStats, enrollInActivity, unenrollFromActivity, applyToActivity, createActivity, submitReview, submitVolunteerReviews, updateActivity, getNPORating, deleteActivity, approveActivityApplication, rejectActivityApplication, resetData, error, loadData, paginatedActivities, hasMore, isLoadingMore, fetchPaginatedActivities]);

    return (
        <ActivityContext.Provider value={value}>
            {children}
        </ActivityContext.Provider>
    );
}

export const ActivityProvider = ({ children }: { children: React.ReactNode }) => <ActivityProviderInner>{children}</ActivityProviderInner>;
