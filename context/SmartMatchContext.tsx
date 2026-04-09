import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    useMemo,
} from 'react';
import { useSegments } from 'expo-router';
import { activityService } from '../services/ActivityService';
import { gemmaService } from '../services/GemmaService';
import { npoService } from '../services/NPOService';
import { smartMatchPreferencesService } from '../services/SmartMatchPreferencesService';
import { useAuth } from './AuthContext';
import { OldSmartMatchResult } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SmartMatchContextType {
    matches: OldSmartMatchResult[];
    allMatches: OldSmartMatchResult[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    lastUpdated: Date | null;
    saveMatch: (match: OldSmartMatchResult) => Promise<void>;
    hideMatch: (match: OldSmartMatchResult) => Promise<void>;
    likeMatch: (match: OldSmartMatchResult) => Promise<void>;
    markMatchSeen: (match: OldSmartMatchResult) => Promise<void>;
    resetHiddenMatches: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const SmartMatchContext = createContext<SmartMatchContextType>({
    matches: [],
    allMatches: [],
    isLoading: false,
    error: null,
    refresh: async () => { },
    lastUpdated: null,
    saveMatch: async () => { },
    hideMatch: async () => { },
    likeMatch: async () => { },
    markMatchSeen: async () => { },
    resetHiddenMatches: async () => { },
});

export const useSmartMatch = () => useContext(SmartMatchContext);

const norm = (value?: string | null) => (value || '').trim().toLowerCase();

function haversineKm(a?: { lat: number; lng: number }, b?: { lat: number; lng: number }) {
    if (!a || !b || !a.lat || !a.lng || !b.lat || !b.lng) return null;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function deriveChips(user: any, activity: any, score: number) {
    const chips: string[] = [];
    const userSkills = (user?.skills || []).map((item: string) => norm(item));
    const activitySkills = (activity?.skills || []).map((item: string) => norm(item));
    const sharedSkills = activitySkills.filter((skill: string) => userSkills.includes(skill));
    if (sharedSkills.length > 0) chips.push(sharedSkills.length > 1 ? 'Competenze utili' : `Skill: ${sharedSkills[0]}`);

    const userInterests = (user?.interests || []).map((item: string) => norm(item));
    const category = norm(activity?.category);
    if (category && userInterests.some((interest: string) => category.includes(interest) || interest.includes(category))) {
        chips.push('In linea coi tuoi interessi');
    }

    const distanceKm = haversineKm(user?.locationCoords, activity?.location?.coords);
    if (distanceKm !== null && distanceKm <= 10) chips.push('Vicino a te');
    else if (distanceKm !== null && distanceKm <= 25) chips.push('Raggiungibile');

    if (activity?.isUrgent) chips.push('Urgente');

    const activityDate = activity?.dateTime ? new Date(activity.dateTime).getTime() : null;
    if (activityDate) {
        const diffDays = (activityDate - Date.now()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 3) chips.push('Nei prossimi giorni');
        else if (diffDays > 3 && diffDays <= 7) chips.push('Questa settimana');
    }

    if (score >= 80) chips.push('Alta compatibilità');
    else if (score >= 65) chips.push('Buon fit');

    return Array.from(new Set(chips)).slice(0, 3);
}

function deriveConfidence(score: number): Pick<OldSmartMatchResult, 'confidence' | 'confidenceLabel' | 'nextStep'> {
    if (score >= 80) {
        return {
            confidence: 'top',
            confidenceLabel: 'Consiglio di Gemma',
            nextStep: 'Apri e valuta questa per prima',
        };
    }
    if (score >= 65) {
        return {
            confidence: 'good',
            confidenceLabel: 'Vale la pena',
            nextStep: 'Confrontala con le altre opportunità',
        };
    }
    return {
        confidence: 'explore',
        confidenceLabel: 'Da valutare',
        nextStep: 'Potrebbe interessarti se vuoi allargare il raggio',
    };
}

function rerankWithPreferences(
    matches: OldSmartMatchResult[],
    user: any,
    prefs: Awaited<ReturnType<typeof smartMatchPreferencesService.getPreferences>>,
    relations: { followedNpoIds: Set<string>; affiliatedNpoIds: Set<string> },
    options?: { ignoreHidden?: boolean; excludeEnrolledUserId?: string | null }
) {
    return matches
        .filter((match) => options?.ignoreHidden || !prefs.hiddenActivityIds.includes(match.id))
        .filter((match) => {
            const enrolledUserId = options?.excludeEnrolledUserId;
            if (!enrolledUserId) return true;
            const iscritti = match.activity?.iscritti || [];
            return !iscritti.includes(enrolledUserId);
        })
        .map((match) => {
            const activity = match.activity;
            let adjustedScore = match.score || 0;
            const npoId = activity?.npoId;

            if (prefs.savedActivityIds.includes(match.id)) adjustedScore += 8;
            if (prefs.likedActivityIds.includes(match.id)) adjustedScore += 10;
            if (activity?.category && prefs.likedCategories.includes(activity.category)) adjustedScore += 7;
            if (activity?.npoId && prefs.likedNpoIds.includes(activity.npoId)) adjustedScore += 6;
            if (prefs.seenActivityIds.includes(match.id)) adjustedScore -= 4;
            if (activity?.isUrgent) adjustedScore += 3;
            if (npoId && relations.affiliatedNpoIds.has(npoId)) adjustedScore += 10;
            else if (npoId && relations.followedNpoIds.has(npoId)) adjustedScore += 5;

            const chips = deriveChips(user, activity, adjustedScore);
            const confidence = deriveConfidence(adjustedScore);

            return {
                ...match,
                score: Math.max(0, Math.min(99, Math.round(adjustedScore))),
                chips,
                saved: prefs.savedActivityIds.includes(match.id),
                liked: prefs.likedActivityIds.includes(match.id),
                seen: prefs.seenActivityIds.includes(match.id),
                ...confidence,
            };
        })
        .sort((a, b) => b.score - a.score);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function SmartMatchProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const segments = useSegments();
    const [matches, setMatches] = useState<OldSmartMatchResult[]>([]);
    const [allMatches, setAllMatches] = useState<OldSmartMatchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const isFetchingRef = useRef(false);
    const fetchSeqRef = useRef(0);
    const segmentKey = segments.join('/');
    const isQuietRoute = [
        '(volunteer)/settings',
        '(volunteer)/privacy',
        '(volunteer)/interests-skills',
        'blocked-users',
        '(volunteer)/referral',
        'help-center',
        '(npo)/settings',
        '(npo)/settings/privacy',
        '(npo)/edit-profile',
    ].some((route) => segmentKey.includes(route));

    const fetchMatches = useCallback(async () => {
        const fetchId = ++fetchSeqRef.current;
        const startedAt = Date.now();
        if (isQuietRoute) {
            console.log('[DEBUG] SmartMatchContext: skipped on quiet route', { fetchId, segmentKey });
            return;
        }

        // Guard: only volunteers with a completed profile
        if (!user || user.role !== 'VOLUNTEER' || !user.profile_completed) {
            console.log('[SmartMatchContext] Skipping — user:', user?.role, 'profile_completed:', user?.profile_completed);
            setMatches([]);
            setAllMatches([]);
            setError(null);
            setLastUpdated(null);
            setIsLoading(false);
            return;
        }

        // Guard: prevent concurrent fetches
        if (isFetchingRef.current) return;

        isFetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            console.log('[SmartMatchContext] Fetching matches via unified ActivityService...', {
                fetchId,
                userId: user.id,
                startedAt,
            });

            const [prefs, volunteerApplications] = await Promise.all([
                smartMatchPreferencesService.getPreferences(user.id),
                npoService.getApplicationsForVolunteer(user.id).catch(() => []),
            ]);
            const relations = {
                followedNpoIds: new Set((user.followedNPOs || []).filter(Boolean)),
                affiliatedNpoIds: new Set(
                    (volunteerApplications || [])
                        .filter((application) => application.status === 'APPROVED')
                        .map((application) => application.npoId)
                        .filter(Boolean)
                ),
            };

            // 1. Chiamata al servizio (che usa get_activities_with_match sotto cofano)
            const primaryResult = await activityService.getActivities({
                userId: user.id,
                limit: 15,
                centerLat: user.locationCoords?.lat || undefined,
                centerLng: user.locationCoords?.lng || undefined,
                statuses: ['APERTA', 'IN_CORSO'],
            });
            console.log('[DEBUG] SmartMatchContext: primary activities resolved', {
                fetchId,
                count: primaryResult.activities.length,
                elapsedMs: Date.now() - startedAt,
            });

            let candidateActivities = primaryResult.activities;

            if (!candidateActivities.length) {
                console.warn('[SmartMatchContext] Primary Smart Match fetch returned 0 activities, trying broader fallback...');
                const fallbackResult = await activityService.getActivities({
                    userId: user.id,
                    limit: 30,
                });
                candidateActivities = fallbackResult.activities.filter((activity) =>
                    ['APERTA', 'IN_CORSO'].includes(activity.status)
                );
                console.log('[DEBUG] SmartMatchContext: broader fallback resolved', {
                    fetchId,
                    count: candidateActivities.length,
                    elapsedMs: Date.now() - startedAt,
                });
            }

            // 2. Filtriamo le attività a cui è già iscritto usando la lista già idratata dal service
            // per evitare query duplicate e semantiche di stato divergenti.
            const mappedMatchesBase: OldSmartMatchResult[] = candidateActivities
                .filter(a => !a.iscritti.includes(user.id))
                .map((a: any) => ({
                    id: a.id,
                    score: a.matchPercentage || 0,
                    reason: "Gemma sta preparando un consiglio personalizzato...",
                    // AppActivity is backwards compatible enough for what SmartMatchCarousel needs
                    activity: a as any
                }));

            const gemmaEnrichedMatches = mappedMatchesBase.length > 0
                ? await gemmaService.getSmartMatchReasons(mappedMatchesBase)
                    .then(result => {
                        console.log('[DEBUG] SmartMatchContext: gemma reasons resolved', {
                            fetchId,
                            reasonsCount: result.reasons?.length || 0,
                            elapsedMs: Date.now() - startedAt,
                        });
                        const reasonsMap = new Map(result.reasons.map((item: any) => [item.activityId, item.reason]));
                        return mappedMatchesBase.map(match => ({
                            ...match,
                            reason: reasonsMap.get(match.id) || "Attività in linea con il tuo profilo attuale."
                        }));
                    })
                    .catch((gemmaError) => {
                        console.error('[SmartMatchContext] Gemma reasons failed:', gemmaError);
                        console.log('[DEBUG] SmartMatchContext: gemma reasons fallback', {
                            fetchId,
                            error: gemmaError?.message || String(gemmaError),
                            elapsedMs: Date.now() - startedAt,
                        });
                        return mappedMatchesBase.map(match => ({
                            ...match,
                            reason: `Match ${Math.round(match.score || 0)}% in linea con il tuo profilo.`
                        }));
                    })
                : mappedMatchesBase;

            const allPersonalizedMatches = rerankWithPreferences(gemmaEnrichedMatches, user, prefs, relations, {
                ignoreHidden: true,
            });
            let personalizedMatches = rerankWithPreferences(gemmaEnrichedMatches, user, prefs, relations, {
                excludeEnrolledUserId: user.id,
            });

            const candidateSummary = candidateActivities.map((activity) => ({
                id: activity.id,
                title: activity.title,
                status: activity.status,
                matchPercentage: activity.matchPercentage || 0,
                isEnrolled: activity.iscritti.includes(user.id),
            }));

            if (!personalizedMatches.length && gemmaEnrichedMatches.length > 0 && prefs.hiddenActivityIds.length > 0) {
                console.warn(
                    '[SmartMatchContext] All candidate matches were hidden by local preferences, ignoring hidden filter for this refresh.',
                    { hiddenCount: prefs.hiddenActivityIds.length, candidateCount: gemmaEnrichedMatches.length }
                );
                personalizedMatches = rerankWithPreferences(gemmaEnrichedMatches, user, {
                    ...prefs,
                    hiddenActivityIds: [],
                }, relations, {
                    ignoreHidden: true,
                    excludeEnrolledUserId: user.id,
                });
            }

            console.log(
                '[SmartMatchContext] Candidate activities:',
                candidateActivities.length,
                'Visible matches:',
                personalizedMatches.length,
                'Hidden prefs:',
                prefs.hiddenActivityIds.length
            );
            console.log('[SmartMatchContext] Diagnostics', {
                fetchId,
                userId: user.id,
                profileCompleted: user.profile_completed,
                candidateSummary,
                visibleMatchIds: personalizedMatches.map((match) => match.id),
                excludedBecauseEnrolled: candidateSummary.filter((activity) => activity.isEnrolled),
                hiddenByPrefs: candidateSummary.filter(
                    (activity) => !activity.isEnrolled && !personalizedMatches.some((match) => match.id === activity.id)
                ),
            });
            setAllMatches(allPersonalizedMatches);
            setMatches(personalizedMatches);
            setLastUpdated(new Date());
            console.log('[DEBUG] SmartMatchContext: fetch completed', {
                fetchId,
                visibleCount: personalizedMatches.length,
                allCount: allPersonalizedMatches.length,
                elapsedMs: Date.now() - startedAt,
            });
        } catch (err: any) {
            console.error('[SmartMatchContext] Error fetching matches:', err);
            console.log('[DEBUG] SmartMatchContext: fetch failed', {
                fetchId,
                error: err?.message || String(err),
                elapsedMs: Date.now() - startedAt,
            });
            setError((current) => current || 'Impossibile caricare i suggerimenti. Riprova tra poco.');
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [isQuietRoute, user?.id, user?.role, user?.profile_completed, user?.locationCoords?.lat, user?.locationCoords?.lng, user?.skills, user?.interests, user?.bio, user?.followedNPOs]);

    // Invalidate cache and refetch on refresh
    const refresh = useCallback(async () => {
        await fetchMatches();
    }, [fetchMatches]);

    const updateLocalMatchState = useCallback((updater: (current: OldSmartMatchResult) => OldSmartMatchResult | null) => {
        setAllMatches((prev) =>
            prev
                .map((match) => updater(match) ?? match)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
        );
        setMatches((prev) =>
            prev
                .map((match) => updater(match))
                .filter((match): match is OldSmartMatchResult => match !== null)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
        );
    }, []);

    const saveMatch = useCallback(async (match: OldSmartMatchResult) => {
        if (!user?.id) return;
        const nextSaved = !match.saved;
        await smartMatchPreferencesService.toggleSaved(user.id, match.id);
        updateLocalMatchState((current) => {
            if (current.id !== match.id) return current;
            return {
                ...current,
                saved: nextSaved,
            };
        });
    }, [updateLocalMatchState, user?.id]);

    const hideMatch = useCallback(async (match: OldSmartMatchResult) => {
        if (!user?.id) return;
        await smartMatchPreferencesService.hideActivity(user.id, match.id);
        setMatches((prev) => prev.filter((current) => current.id !== match.id));
        setAllMatches((prev) => prev.map((current) => current.id === match.id ? { ...current, seen: true } : current));
    }, [user?.id]);

    const likeMatch = useCallback(async (match: OldSmartMatchResult) => {
        if (!user?.id || !match.activity) return;
        const nextLiked = !match.liked;
        await smartMatchPreferencesService.toggleLikedActivity(
            user.id,
            match.id,
            match.activity.category,
            match.activity.npoId
        );
        updateLocalMatchState((current) => {
            if (current.id !== match.id) return current;
            const baseScore = current.score || 0;
            const nextScore = nextLiked ? Math.min(99, baseScore + 10) : Math.max(0, baseScore - 10);
            const nextConfidence = deriveConfidence(nextScore);
            return {
                ...current,
                liked: nextLiked,
                score: nextScore,
                confidence: nextConfidence.confidence,
                confidenceLabel: nextConfidence.confidenceLabel,
                nextStep: nextConfidence.nextStep,
            };
        });
    }, [updateLocalMatchState, user?.id]);

    const markMatchSeen = useCallback(async (match: OldSmartMatchResult) => {
        if (!user?.id) return;
        await smartMatchPreferencesService.markSeen(user.id, match.id);
    }, [user?.id]);

    const resetHiddenMatches = useCallback(async () => {
        if (!user?.id) return;
        await smartMatchPreferencesService.resetHidden(user.id);
        await fetchMatches();
    }, [fetchMatches, user?.id]);

    // Auto-fetch when a volunteer user loads the context
    useEffect(() => {
        if (isQuietRoute) return;
        if (user?.role === 'VOLUNTEER' && user?.profile_completed) {
            fetchMatches();
        }
    }, [fetchMatches, isQuietRoute, user?.id, user?.role, user?.profile_completed]);

    // Re-fetch when the volunteer updates their bio/skills/interests
    const profileKey = [user?.bio, user?.skills?.join(','), user?.interests?.join(',')].join('|');
    const prevProfileKey = useRef(profileKey);
    useEffect(() => {
        if (isQuietRoute) return;
        if (prevProfileKey.current !== profileKey && user?.role === 'VOLUNTEER') {
            prevProfileKey.current = profileKey;
            fetchMatches();
        }
    }, [fetchMatches, isQuietRoute, profileKey, user?.role]);

    const value = useMemo(
        () => ({
            matches,
            allMatches,
            isLoading,
            error,
            refresh,
            lastUpdated,
            saveMatch,
            hideMatch,
            likeMatch,
            markMatchSeen,
            resetHiddenMatches,
        }),
        [matches, allMatches, isLoading, error, refresh, lastUpdated, saveMatch, hideMatch, likeMatch, markMatchSeen, resetHiddenMatches]
    );

    return (
        <SmartMatchContext.Provider value={value}>
            {children}
        </SmartMatchContext.Provider>
    );
}
