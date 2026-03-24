import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { npoService } from '../services/NPOService';
import { AppUser } from '../types';

export const useNPOFollow = () => {
    const { user, setUser } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    const isFollowingNPO = useCallback((npoId: string) => {
        if (!user || user.role !== 'VOLUNTEER') return false;
        return user.followedNPOs?.includes(npoId) || false;
    }, [user]);

    const followNPO = useCallback(async (npoId: string) => {
        if (!user || user.role !== 'VOLUNTEER') return false;
        
        setIsProcessing(true);
        try {
            await npoService.followNPO(npoId, user.id);
            
            // Update local user state
            const updatedFollowed = [...(user.followedNPOs || []), npoId];
            setUser({
                ...user,
                followedNPOs: updatedFollowed
            });
            return true;
        } catch (error) {
            console.error("Error following NPO:", error);
            return false;
        } finally {
            setIsProcessing(false);
        }
    }, [user, setUser]);

    const unfollowNPO = useCallback(async (npoId: string) => {
        if (!user || user.role !== 'VOLUNTEER') return false;

        setIsProcessing(true);
        try {
            await npoService.unfollowNPO(npoId, user.id);
            
            // Update local user state
            const updatedFollowed = (user.followedNPOs || []).filter(id => id !== npoId);
            setUser({
                ...user,
                followedNPOs: updatedFollowed
            });
            return true;
        } catch (error) {
            console.error("Error unfollowing NPO:", error);
            return false;
        } finally {
            setIsProcessing(false);
        }
    }, [user, setUser]);

    return {
        isFollowingNPO,
        followNPO,
        unfollowNPO,
        isProcessing
    };
};
