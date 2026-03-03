import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { Story } from '../types/stories';
import { useAuth } from './AuthContext';

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
    const [stories, setStories] = useState<Story[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStories = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('stories')
                .select(`
                    *,
                    author:profiles!author_id (
                        id,
                        name:full_name,
                        npo_name,
                        avatar:avatar_url,
                        role
                    ),
                    linked_activity:activities!linked_activity_id (
                        id, title, date_time, status
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
    }, []);

    // Upload image to Supabase Storage
    const uploadImage = async (imageUri: string): Promise<string | null> => {
        try {
            const fileName = `stories/${user?.id}/${Date.now()}.jpg`;
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const { data, error } = await supabase.storage
                .from('community_media')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
            if (error) throw error;
            const { data: urlData } = supabase.storage
                .from('community_media')
                .getPublicUrl(data.path);
            return urlData.publicUrl;
        } catch (e) {
            console.error('Story image upload error:', e);
            return null;
        }
    };

    const createStory = async (imageUri: string, caption?: string, linkedActivityId?: string) => {
        if (!user) return;
        const imageUrl = await uploadImage(imageUri);
        if (!imageUrl) throw new Error('Upload fallito');

        const { error } = await supabase.from('stories').insert({
            author_id: user.id,
            image_url: imageUrl,
            caption: caption || null,
            linked_activity_id: linkedActivityId || null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        if (error) throw error;
        await fetchStories();
    };

    const deleteStory = async (id: string) => {
        const { error } = await supabase.from('stories').delete().eq('id', id);
        if (error) throw error;
        setStories(prev => prev.filter(s => s.id !== id));
    };

    useEffect(() => {
        if (user) fetchStories();
    }, [user, fetchStories]);

    // Realtime: refresh on any story insert
    useEffect(() => {
        const channel = supabase
            .channel('stories_feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
                fetchStories();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStories]);

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
