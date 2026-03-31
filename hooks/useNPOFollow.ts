import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { npoService } from '../services/NPOService';

export const useNPOFollow = () => {
    const { user, setUser } = useAuth();
    const [processingIds, setProcessingIds] = useState<string[]>([]);

    const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`follow timeout after ${ms}ms`)), ms)),
        ]);
    }, []);

    const setProcessing = useCallback((npoId: string, value: boolean) => {
        setProcessingIds((prev) => {
            if (value) {
                return prev.includes(npoId) ? prev : [...prev, npoId];
            }
            return prev.filter((id) => id !== npoId);
        });
    }, []);

    const isFollowingNPO = useCallback((npoId: string) => {
        if (!user || user.role !== 'VOLUNTEER') return false;
        return user.followedNPOs?.includes(npoId) || false;
    }, [user]);

    const isProcessingNPO = useCallback((npoId: string) => processingIds.includes(npoId), [processingIds]);

    const followNPO = useCallback(async (npoId: string) => {
        if (!user || user.role !== 'VOLUNTEER') return false;
        if (processingIds.includes(npoId)) return false;
        if (user.followedNPOs?.includes(npoId)) return true;

        setProcessing(npoId, true);
        const previousUser = user;
        try {
            const updatedFollowed = Array.from(new Set([...(user.followedNPOs || []), npoId]));
            setUser({
                ...user,
                followedNPOs: updatedFollowed,
                followed_entities: updatedFollowed.map((id) => ({ npo_id: id })),
            });

            await withTimeout(npoService.followNPO(npoId, user.id), 4000);
            return true;
        } catch (error) {
            console.error("Error following NPO:", error);
            setUser(previousUser);
            return false;
        } finally {
            setProcessing(npoId, false);
        }
    }, [user, setUser, processingIds, setProcessing, withTimeout]);

    const unfollowNPO = useCallback(async (npoId: string) => {
        if (!user || user.role !== 'VOLUNTEER') return false;
        if (processingIds.includes(npoId)) return false;

        setProcessing(npoId, true);
        const previousUser = user;
        try {
            const updatedFollowed = (user.followedNPOs || []).filter(id => id !== npoId);
            setUser({
                ...user,
                followedNPOs: updatedFollowed,
                followed_entities: updatedFollowed.map((id) => ({ npo_id: id })),
            });
            await withTimeout(npoService.unfollowNPO(npoId, user.id), 4000);
            return true;
        } catch (error) {
            console.error("Error unfollowing NPO:", error);
            setUser(previousUser);
            return false;
        } finally {
            setProcessing(npoId, false);
        }
    }, [user, setUser, processingIds, setProcessing, withTimeout]);

    return {
        isFollowingNPO,
        isProcessingNPO,
        followNPO,
        unfollowNPO,
        isProcessing: processingIds.length > 0,
    };
};
