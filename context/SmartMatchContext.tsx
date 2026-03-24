import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    useMemo,
} from 'react';
import { supabase } from '../utils/supabase';
import { activityService } from '../services/ActivityService';
import { gemmaService } from '../services/GemmaService';
import { useAuth } from './AuthContext';
import { OldSmartMatchResult } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SmartMatchContextType {
    matches: OldSmartMatchResult[];
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
    const [matches, setMatches] = useState<OldSmartMatchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const isFetchingRef = useRef(false);

    const fetchMatches = useCallback(async () => {
        // Guard: only volunteers with a completed profile
        if (!user || user.role !== 'VOLUNTEER' || !user.profile_completed) {
            console.log('[SmartMatchContext] Skipping — user:', user?.role, 'profile_completed:', user?.profile_completed);
            return;
        }

        // Guard: prevent concurrent fetches
        if (isFetchingRef.current) return;

        isFetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            console.log('[SmartMatchContext] Fetching matches via unified ActivityService...');

            // 1. Chiamata al servizio (che usa get_activities_with_match sotto cofano)
            const { activities } = await activityService.getActivities({
                userId: user.id,
                limit: 15, // buffer in caso alcune siano già prenotate
                centerLat: user.locationCoords?.lat || undefined,
                centerLng: user.locationCoords?.lng || undefined,
                statuses: ['APERTA', 'IN_CORSO'],
            });

            // 2. Filtriamo le attività a cui è già iscritto
            const { data: enrollments } = await supabase
                .from('activity_participants')
                .select('activity_id')
                .eq('user_id', user.id);

            const enrolledIds = new Set((enrollments || []).map(e => e.activity_id));

            // 3. Mappiamo nel formato atteso dalla UI
            const mappedMatchesBase: OldSmartMatchResult[] = activities
                .filter(a => !enrolledIds.has(a.id))
                .slice(0, 5) // prendiamo le migliori 5
                .map((a: any) => ({
                    id: a.id,
                    score: a.matchPercentage || 0,
                    reason: "Gemma sta preparando un consiglio personalizzato...",
                    // AppActivity is backwards compatible enough for what SmartMatchCarousel needs
                    activity: a as any
                }));

            const mappedMatches = mappedMatchesBase.length > 0
                ? await gemmaService.getSmartMatchReasons(mappedMatchesBase)
                    .then(result => {
                        const reasonsMap = new Map(result.reasons.map((item: any) => [item.activityId, item.reason]));
                        return mappedMatchesBase.map(match => ({
                            ...match,
                            reason: reasonsMap.get(match.id) || "Attività in linea con il tuo profilo attuale."
                        }));
                    })
                    .catch((gemmaError) => {
                        console.error('[SmartMatchContext] Gemma reasons failed:', gemmaError);
                        return mappedMatchesBase.map(match => ({
                            ...match,
                            reason: `Match ${Math.round(match.score || 0)}% in linea con il tuo profilo.`
                        }));
                    })
                : mappedMatchesBase;

            console.log(`[SmartMatchContext] Found ${mappedMatches.length} unified matches.`);
            setMatches(mappedMatches);
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error('[SmartMatchContext] Error fetching matches:', err);
            setError('Impossibile caricare i suggerimenti. Riprova tra poco.');
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [user]);

    // Invalidate cache and refetch on refresh
    const refresh = useCallback(async () => {
        await fetchMatches();
    }, [fetchMatches]);

    // Auto-fetch when a volunteer user loads the context
    useEffect(() => {
        if (user?.role === 'VOLUNTEER' && user?.profile_completed) {
            fetchMatches();
        }
    }, [user?.id, user?.role, user?.profile_completed]);

    // Re-fetch when the volunteer updates their bio/skills/interests
    const profileKey = [user?.bio, user?.skills?.join(','), user?.interests?.join(',')].join('|');
    const prevProfileKey = useRef(profileKey);
    useEffect(() => {
        if (prevProfileKey.current !== profileKey && user?.role === 'VOLUNTEER') {
            prevProfileKey.current = profileKey;
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
