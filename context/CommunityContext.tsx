import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { CommunityPost, PostReaction, ReactionType } from '../types/community';
import { useAuth } from './AuthContext';
import { storageService } from '../services/StorageService';

interface CommunityContextType {
    posts: CommunityPost[];
    isLoading: boolean;
    fetchFeed: () => Promise<void>;
    createPost: (caption: string, imageUri: string | null, linkedActivityId?: string) => Promise<void>;
    toggleReaction: (postId: string, reaction: ReactionType) => Promise<void>;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export function CommunityProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchFeed = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('community_posts')
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
                        id,
                        title,
                        date_start,
                        status
                    ),
                    reactions:post_reactions (
                        id, post_id, user_id, reaction, created_at
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;
            setPosts((data as unknown as CommunityPost[]) || []);
        } catch (e) {
            console.error('Community fetchFeed error:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Upload image to Supabase Storage and return public URL (Use StorageService for robustness)
    const uploadImage = useCallback(async (imageUri: string): Promise<string | null> => {
        if (!user) return null;
        try {
            return await storageService.uploadCommunityImage(user.id, imageUri);
        } catch (e) {
            console.error('Community image upload error:', e);
            return null;
        }
    }, [user]);

    const createPost = async (caption: string, imageUri: string | null, linkedActivityId?: string) => {
        if (!user) return;

        let imageUrl: string | null = null;
        if (imageUri) {
            imageUrl = await uploadImage(imageUri);
        }

        const { error } = await supabase.from('community_posts').insert({
            author_id: user.id,
            caption: caption || null,
            image_url: imageUrl,
            linked_activity_id: linkedActivityId || null,
        });

        if (error) throw error;
        await fetchFeed();
    };

    const toggleReaction = async (postId: string, reaction: ReactionType) => {
        if (!user) return;

        // Check if reaction already exists
        const existingPost = posts.find(p => p.id === postId);
        const existingReaction = existingPost?.reactions?.find(
            r => r.user_id === user.id && r.reaction === reaction
        );

        if (existingReaction) {
            // Remove reaction
            await supabase
                .from('post_reactions')
                .delete()
                .eq('id', existingReaction.id);

            setPosts(prev => prev.map(p => {
                if (p.id !== postId) return p;
                return {
                    ...p,
                    reactions: p.reactions?.filter(r => r.id !== existingReaction.id) || []
                };
            }));
        } else {
            // Add reaction
            const { data } = await supabase
                .from('post_reactions')
                .insert({ post_id: postId, user_id: user.id, reaction })
                .select()
                .single();

            if (data) {
                setPosts(prev => prev.map(p => {
                    if (p.id !== postId) return p;
                    return {
                        ...p,
                        reactions: [...(p.reactions || []), data as PostReaction]
                    };
                }));
            }
        }
    };

    // Initial load
    useEffect(() => {
        if (user) fetchFeed();
    }, [user, fetchFeed]);

    // Realtime subscription for new posts
    useEffect(() => {
        const channel = supabase
            .channel('community_feed')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'community_posts',
            }, () => {
                fetchFeed(); // Reload on new post
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchFeed]);

    return (
        <CommunityContext.Provider value={{ posts, isLoading, fetchFeed, createPost, toggleReaction }}>
            {children}
        </CommunityContext.Provider>
    );
}

export function useCommunity() {
    const ctx = useContext(CommunityContext);
    if (!ctx) throw new Error('useCommunity must be inside CommunityProvider');
    return ctx;
}
