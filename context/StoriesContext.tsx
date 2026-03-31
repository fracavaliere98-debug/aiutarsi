import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { supabase } from '../utils/supabase';
import { Story } from '../types/stories';
import { useAuth } from './AuthContext';
import { storageService } from '../services/StorageService';
import { moderateCommunityContent } from '../utils/communityModeration';
import { triggerNotificationJobs } from '../utils/notificationJobs';

interface StoriesContextType {
    stories: Story[];
    isLoading: boolean;
    fetchStories: () => Promise<void>;
    createStory: (imageUri: string, caption?: string, linkedActivityId?: string) => Promise<void>;
    deleteStory: (id: string) => Promise<void>;
}

const StoriesContext = createContext<StoriesContextType | undefined>(undefined);

export function StoriesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const segments = useSegments();
    const [stories, setStories] = useState<Story[]>([]);
    const [isLoading, setIsLoading] = useState(false);
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

    const fetchStories = useCallback(async () => {
        if (isQuietRoute) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('stories')
                .select(`
                    *,
                    author:profiles!author_id (
                        id,
                        full_name,
                        npo_name,
                        avatar_url,
                        role
                    ),
                    linked_activity:activities!linked_activity_id (
                        id, title, date_start, status
                    )
                `)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStories((data as unknown as Story[]) || []);
        } catch (e) {
            console.error('StoriesContext fetchStories error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [isQuietRoute]);

    // Upload image to Supabase Storage (Use StorageService for robustness)
    const uploadImage = useCallback(async (imageUri: string): Promise<string | null> => {
        if (!user) return null;
        try {
            return await storageService.uploadStoryImage(user.id, imageUri);
        } catch (e) {
            console.error('Story image upload error:', e);
            return null;
        }
    }, [user]);

    const createStory = async (imageUri: string, caption?: string, linkedActivityId?: string) => {
        if (!user) return;
        const imageUrl = await uploadImage(imageUri);
        if (!imageUrl) throw new Error('Upload fallito');

        const moderation = await moderateCommunityContent({
            caption: caption || '',
            imageUrl,
        });

        if (!moderation.safe) {
            throw new Error(moderation.reason || 'Story non approvata dai controlli automatici.');
        }

        const { error } = await supabase.from('stories').insert({
            author_id: user.id,
            image_url: imageUrl,
            caption: caption || null,
            linked_activity_id: linkedActivityId || null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        if (error) throw error;

        if (user.role === 'NPO') triggerNotificationJobs({ minIntervalMs: 0 });

        await fetchStories();
    };

    const deleteStory = async (id: string) => {
        const { error } = await supabase.from('stories').delete().eq('id', id);
        if (error) throw error;
        setStories(prev => prev.filter(s => s.id !== id));
    };

    useEffect(() => {
        if (isQuietRoute) return;
        if (user) fetchStories();
    }, [user, fetchStories, isQuietRoute]);

    // Realtime: refresh on any story insert
    useEffect(() => {
        if (isQuietRoute) return;
        const channel = supabase
            .channel('stories_feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
                fetchStories();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStories, isQuietRoute]);

    return (
        <StoriesContext.Provider value={{ stories, isLoading, fetchStories, createStory, deleteStory }}>
            {children}
        </StoriesContext.Provider>
    );
}

export function useStories() {
    const ctx = useContext(StoriesContext);
    if (!ctx) throw new Error('useStories must be inside StoriesProvider');
    return ctx;
}
