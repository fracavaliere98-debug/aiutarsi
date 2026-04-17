import { useMemo } from 'react';
import { AppActivity, AppUser } from '../../types';
import { useSmartMatchesQuery, useSmartMatchActivityScoresQuery } from './queries';
import {
    useHideSmartMatchMutation,
    useLikeSmartMatchMutation,
    useMarkSmartMatchSeenMutation,
    useResetHiddenSmartMatchesMutation,
    useSaveSmartMatchMutation,
} from './mutations';

const EMPTY_MATCHES: any[] = [];
const EMPTY_SCORE_LOOKUP: Record<string, never> = {};

export function useSmartMatchView(user?: AppUser | null, options?: { enabled?: boolean }) {
    const query = useSmartMatchesQuery(user, options);
    const saveMutation = useSaveSmartMatchMutation(user?.id);
    const hideMutation = useHideSmartMatchMutation(user?.id);
    const likeMutation = useLikeSmartMatchMutation(user?.id);
    const seenMutation = useMarkSmartMatchSeenMutation(user?.id);
    const resetMutation = useResetHiddenSmartMatchesMutation(user?.id);

    return {
        matches: query.data?.matches ?? EMPTY_MATCHES,
        allMatches: query.data?.allMatches ?? EMPTY_MATCHES,
        isLoading: query.isLoading || query.isFetching,
        error: query.error ? 'Impossibile caricare i suggerimenti. Riprova tra poco.' : null,
        lastUpdated: query.data?.lastUpdated ? new Date(query.data.lastUpdated) : null,
        refresh: query.refetch,
        saveMatch: saveMutation.mutateAsync,
        hideMatch: hideMutation.mutateAsync,
        likeMatch: likeMutation.mutateAsync,
        markMatchSeen: seenMutation.mutateAsync,
        resetHiddenMatches: resetMutation.mutateAsync,
    };
}

export function useSmartMatchActivityScoresView(
    user: AppUser | null | undefined,
    activities: AppActivity[],
    options?: { enabled?: boolean }
) {
    const query = useSmartMatchActivityScoresQuery(user, activities, options);

    const scoreMap = useMemo(
        () => new Map(Object.entries(query.data?.byActivityId ?? EMPTY_SCORE_LOOKUP)),
        [query.data?.byActivityId]
    );

    return {
        scoreMap,
        orderedMatches: query.data?.ordered ?? EMPTY_MATCHES,
        isLoading: query.isLoading || query.isFetching,
        refetch: query.refetch,
    };
}
