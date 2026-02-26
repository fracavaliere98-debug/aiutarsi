import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    useMemo,
} from 'react';
import * as Location from 'expo-location';
import { GeminiMatch, geminiMatchService, GeminiQuotaDailyError } from '../services/GeminiMatchService';
import { activityService } from '../services/ActivityService';
import { useAuth } from './AuthContext';
import { Activity } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SmartMatchContextType {
    matches: GeminiMatch[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    lastUpdated: Date | null;
}

// ── Context ───────────────────────────────────────────────────────────────────
const SmartMatchContext = createContext<SmartMatchContextType>({
    matches: [],
    isLoading: false,
    error: null,
    refresh: async () => { },
    lastUpdated: null,
});

export const useSmartMatch = () => useContext(SmartMatchContext);

// ── Provider ──────────────────────────────────────────────────────────────────
export function SmartMatchProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [matches, setMatches] = useState<GeminiMatch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const isFetchingRef = useRef(false);

    const fetchMatches = useCallback(async () => {
        // Guard: only volunteers with a completed profile
        if (!user || user.role !== 'VOLUNTEER' || !user.profileCompleted) {
            console.log('[SmartMatchContext] Skipping — user:', user?.role, 'profileCompleted:', user?.profileCompleted);
            return;
        }
        // Guard: prevent concurrent fetches
        if (isFetchingRef.current) return;

        isFetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            // 1. Get volunteer's location (or fallback to a default Italian city)
            let lat = user.locationCoords?.lat ?? 41.9028; // Rome fallback
            let lng = user.locationCoords?.lng ?? 12.4964;

            // Try to get device location if user has no saved coords
            if (!user.locationCoords) {
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const loc = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });
                        lat = loc.coords.latitude;
                        lng = loc.coords.longitude;
                    }
                } catch {
                    // Silent fallback — use Rome coords
                }
            }

            // 2. Fetch 15 nearest open activities
            // Strategy: try geographically-sorted first, fallback to global list
            // (needed when activity coordinates in DB are incorrect/missing)
            let openActivities: Activity[] = (await activityService.getActivitiesByRadius(lat, lng, 100))
                .filter((a) => a.status === 'APERTA').slice(0, 15);

            if (openActivities.length === 0) {
                // Fallback: fetch all open activities (no geo-filter)
                console.log('[SmartMatchContext] No nearby activities found — falling back to global list');
                const { activities: allActivities } = await activityService.getActivities({
                    limit: 15,
                    onlyAvailable: false,
                });
                openActivities = allActivities.filter((a) => a.status === 'APERTA').slice(0, 15);
            }

            console.log(`[SmartMatchContext] Found ${openActivities.length} activities for matching`);

            // 3. Call Gemini matching service
            const result = await geminiMatchService.getSmartMatches(user, openActivities);
            setMatches(result);
            setLastUpdated(new Date());
        } catch (err: any) {
            if (err instanceof GeminiQuotaDailyError) {
                // Daily quota exhausted — not a bug, reset tomorrow
                console.warn('[SmartMatchContext] Daily quota exhausted.');
                setError('quota_daily');
            } else {
                console.error('[SmartMatchContext] Error fetching matches:', err);
                setError('Impossibile caricare i suggerimenti AI. Riprova tra poco.');
            }
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [user]);

    // Invalidate cache and refetch on refresh
    const refresh = useCallback(async () => {
        if (user?.id) {
            await geminiMatchService.invalidateCache(user.id);
        }
        await fetchMatches();
    }, [user?.id, fetchMatches]);

    // Auto-fetch when a volunteer user loads the context
    useEffect(() => {
        if (user?.role === 'VOLUNTEER' && user?.profileCompleted) {
            fetchMatches();
        }
    }, [user?.id, user?.role, user?.profileCompleted]);

    // Re-fetch when the volunteer updates their bio/skills/interests
    const profileKey = [user?.bio, user?.skills?.join(','), user?.interests?.join(',')].join('|');
    const prevProfileKey = useRef(profileKey);
    useEffect(() => {
        if (prevProfileKey.current !== profileKey && user?.role === 'VOLUNTEER') {
            prevProfileKey.current = profileKey;
            // Invalidate cache so the update triggers a fresh AI call
            if (user?.id) geminiMatchService.invalidateCache(user.id);
            fetchMatches();
        }
    }, [profileKey]);

    const value = useMemo(
        () => ({ matches, isLoading, error, refresh, lastUpdated }),
        [matches, isLoading, error, refresh, lastUpdated]
    );

    return (
        <SmartMatchContext.Provider value={value}>
            {children}
        </SmartMatchContext.Provider>
    );
}
