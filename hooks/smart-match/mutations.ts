import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OldSmartMatchResult } from '../../types';
import { smartMatchPreferencesService } from '../../services/SmartMatchPreferencesService';
import { smartMatchKeys } from './keys';

async function invalidateSmartMatchQueries(queryClient: ReturnType<typeof useQueryClient>) {
    await queryClient.invalidateQueries({ queryKey: smartMatchKeys.all });
}

export function useSaveSmartMatchMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (match: OldSmartMatchResult) => {
            if (!userId) throw new Error('Missing user id');
            await smartMatchPreferencesService.toggleSaved(userId, match.id);
            return true;
        },
        onSuccess: async () => {
            await invalidateSmartMatchQueries(queryClient);
        },
    });
}

export function useHideSmartMatchMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (match: OldSmartMatchResult) => {
            if (!userId) throw new Error('Missing user id');
            await smartMatchPreferencesService.hideActivity(userId, match.id);
            return true;
        },
        onSuccess: async () => {
            await invalidateSmartMatchQueries(queryClient);
        },
    });
}

export function useLikeSmartMatchMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (match: OldSmartMatchResult) => {
            if (!userId || !match.activity) throw new Error('Missing smart match context');
            await smartMatchPreferencesService.toggleLikedActivity(
                userId,
                match.id,
                match.activity.category,
                match.activity.npoId
            );
            return true;
        },
        onSuccess: async () => {
            await invalidateSmartMatchQueries(queryClient);
        },
    });
}

export function useMarkSmartMatchSeenMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (match: OldSmartMatchResult) => {
            if (!userId) throw new Error('Missing user id');
            await smartMatchPreferencesService.markSeen(userId, match.id);
            return true;
        },
        onSuccess: async () => {
            await invalidateSmartMatchQueries(queryClient);
        },
    });
}

export function useResetHiddenSmartMatchesMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            if (!userId) throw new Error('Missing user id');
            await smartMatchPreferencesService.resetHidden(userId);
            return true;
        },
        onSuccess: async () => {
            await invalidateSmartMatchQueries(queryClient);
        },
    });
}
