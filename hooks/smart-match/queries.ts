import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppActivity, AppUser, OldSmartMatchResult } from '../../types';
import { activityService } from '../../services/ActivityService';
import { gemmaService } from '../../services/GemmaService';
import { npoService } from '../../services/NPOService';
import { smartMatchPreferencesService } from '../../services/SmartMatchPreferencesService';
import { getLegacyActivityMatchSnapshot } from '../../utils/smartMatchLegacy';
import { smartMatchKeys } from './keys';
import { rerankSmartMatches } from './selectors';

export type SmartMatchQueryData = {
    matches: OldSmartMatchResult[];
    allMatches: OldSmartMatchResult[];
    lastUpdated: string | null;
};

export type SmartMatchActivityScoresData = {
    byActivityId: Record<string, OldSmartMatchResult>;
    ordered: OldSmartMatchResult[];
};

export function getSmartMatchProfileFingerprint(user?: AppUser | null) {
    if (!user?.id) return 'anonymous';
    return [
        user.id,
        user.bio || '',
        (user.skills || []).join(','),
        (user.interests || []).join(','),
        user.locationCoords?.lat ?? '',
        user.locationCoords?.lng ?? '',
        (user.followedNPOs || []).join(','),
        user.profile_completed ? 'complete' : 'incomplete',
    ].join('|');
}

async function fetchSmartMatches(user: AppUser): Promise<SmartMatchQueryData> {
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

    const primaryResult = await activityService.getActivities({
        userId: user.id,
        limit: 15,
        centerLat: user.locationCoords?.lat || undefined,
        centerLng: user.locationCoords?.lng || undefined,
        statuses: ['APERTA', 'IN_CORSO'],
    });

    let candidateActivities = primaryResult.activities;

    if (!candidateActivities.length) {
        const fallbackResult = await activityService.getActivities({
            userId: user.id,
            limit: 30,
        });
        candidateActivities = fallbackResult.activities.filter((activity) =>
            ['APERTA', 'IN_CORSO'].includes(activity.status)
        );
    }

    const mappedMatchesBase: OldSmartMatchResult[] = candidateActivities
        .filter((activity) => !activity.iscritti.includes(user.id))
        .map((activity) => ({
            id: activity.id,
            score: getLegacyActivityMatchSnapshot(activity),
            reason: 'Gemma sta preparando un consiglio personalizzato...',
            activity: activity as any,
        }));

    const gemmaEnrichedMatches = mappedMatchesBase.length > 0
        ? await gemmaService.getSmartMatchReasons(mappedMatchesBase)
            .then((result) => {
                const reasonsMap = new Map(result.reasons.map((item: any) => [item.activityId, item.reason]));
                return mappedMatchesBase.map((match) => ({
                    ...match,
                    reason: reasonsMap.get(match.id) || 'Attività in linea con il tuo profilo attuale.',
                }));
            })
            .catch(() => {
                return mappedMatchesBase.map((match) => ({
                    ...match,
                    reason: `Match ${Math.round(match.score || 0)}% in linea con il tuo profilo.`,
                }));
            })
        : mappedMatchesBase;

    const allMatches = rerankSmartMatches(gemmaEnrichedMatches, user, prefs, relations, {
        ignoreHidden: true,
    });

    let matches = rerankSmartMatches(gemmaEnrichedMatches, user, prefs, relations, {
        excludeEnrolledUserId: user.id,
    });

    if (!matches.length && gemmaEnrichedMatches.length > 0 && prefs.hiddenActivityIds.length > 0) {
        matches = rerankSmartMatches(gemmaEnrichedMatches, user, {
            ...prefs,
            hiddenActivityIds: [],
        }, relations, {
            ignoreHidden: true,
            excludeEnrolledUserId: user.id,
        });
    }

    return {
        matches,
        allMatches,
        lastUpdated: new Date().toISOString(),
    };
}

async function fetchSmartMatchActivityScores(
    user: AppUser,
    activities: AppActivity[]
): Promise<SmartMatchActivityScoresData> {
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

    const baseMatches: OldSmartMatchResult[] = activities.map((activity) => ({
        id: activity.id,
        score: getLegacyActivityMatchSnapshot(activity),
        reason: `Match ${Math.round(getLegacyActivityMatchSnapshot(activity))}% in linea con il tuo profilo.`,
        activity: activity as any,
    }));

    const ordered = rerankSmartMatches(baseMatches, user, prefs, relations, {
        ignoreHidden: true,
    });

    return {
        byActivityId: Object.fromEntries(ordered.map((match) => [match.id, match])),
        ordered,
    };
}

export function useSmartMatchesQuery(user?: AppUser | null, options?: { enabled?: boolean }) {
    const profileFingerprint = getSmartMatchProfileFingerprint(user);

    return useQuery({
        queryKey: smartMatchKeys.list(user?.id, profileFingerprint),
        queryFn: () => fetchSmartMatches(user!),
        enabled: (options?.enabled ?? true) && !!user?.id && user.role === 'VOLUNTEER' && !!user.profile_completed,
        staleTime: 30_000,
    });
}

export function useSmartMatchActivityScoresQuery(
    user: AppUser | null | undefined,
    activities: AppActivity[],
    options?: { enabled?: boolean }
) {
    const profileFingerprint = getSmartMatchProfileFingerprint(user);
    const activityIds = activities.map((activity) => activity.id).sort();

    return useQuery({
        queryKey: smartMatchKeys.activityScores(user?.id, activityIds, profileFingerprint),
        queryFn: () => fetchSmartMatchActivityScores(user!, activities),
        enabled:
            (options?.enabled ?? true) &&
            !!user?.id &&
            user.role === 'VOLUNTEER' &&
            !!user.profile_completed &&
            activityIds.length > 0,
        staleTime: 30_000,
    });
}

export function getSmartMatchFromCache(
    queryClient: ReturnType<typeof useQueryClient>,
    userId: string | undefined,
    profileFingerprint: string,
    activityId: string
) {
    const data = queryClient.getQueryData<SmartMatchQueryData>(smartMatchKeys.list(userId, profileFingerprint));
    return data?.allMatches.find((match) => match.id === activityId);
}
