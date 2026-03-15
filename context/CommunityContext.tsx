import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { CommunityPost, PostReaction, ReactionType } from '../types/community';
import { useAuth } from './AuthContext';
import { storageService } from '../services/StorageService';

interface CommunityContextType {
    posts: CommunityPost[];
    isLoading: boolean;
    fetchFeed: (lastCreatedAt?: string) => Promise<void>;
    createPost: (caption: string, imageUris: string[], linkedActivityId?: string) => Promise<void>;
    updatePost: (postId: string, caption: string, newLocalUris: string[], retainedExistingUrls: string[], linkedActivityId?: string) => Promise<void>;
    deletePost: (postId: string) => Promise<void>;
    reportPost: (postId: string, reason: string) => Promise<void>;
    toggleReaction: (postId: string, reaction: ReactionType) => Promise<void>;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export function CommunityProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchFeed = useCallback(async (lastCreatedAt?: string) => {
        setIsLoading(true);
        try {
            // Bidirectional block filter: exclude posts from users I blocked AND users who blocked me
            let blockedAuthorIds: string[] = [];
            if (user?.id) {
                const [{ data: iBlocked }, { data: blockedMe }] = await Promise.all([
                    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id),
                    supabase.from('blocked_users').select('blocker_id').eq('blocked_id', user.id),
                ]);
                const blockSet = new Set<string>();
                iBlocked?.forEach((r: any) => blockSet.add(r.blocked_id));
                blockedMe?.forEach((r: any) => blockSet.add(r.blocker_id));
                blockedAuthorIds = Array.from(blockSet);
            }

            let query = supabase
                .from('community_posts')
                .select(`
                    id,
                    caption,
                    image_url,
                    images_urls,
                    author_id,
                    linked_activity_id,
                    created_at,
                    status,
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
                .not('status', 'in', '("shadow_banned","removed")')
                .order('created_at', { ascending: false })
                .limit(30);

            // Apply bidirectional block filter
            if (blockedAuthorIds.length > 0) {
                query = query.not('author_id', 'in', `(${blockedAuthorIds.join(',')})`);
            }

            if (lastCreatedAt) {
                query = query.lt('created_at', lastCreatedAt);
            }

            const { data, error } = await query;
            if (error) throw error;

            const newPosts = (data as unknown as CommunityPost[]) || [];
            if (lastCreatedAt) {
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
                    return [...prev, ...uniqueNew];
                });
            } else {
                setPosts(newPosts);
            }
        } catch (e: any) {
            console.error('Community fetchFeed error:', e);
            if (e && typeof e === 'object') {
                console.error('Error details:', JSON.stringify(e, null, 2));
            }
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

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

    const createPost = async (caption: string, imageUris: string[], linkedActivityId?: string) => {
        if (!user) return;

        let imageUrls: string[] = [];
        if (imageUris.length > 0) {
            imageUrls = await storageService.uploadCommunityImages(user.id, imageUris);
        }

        const { error } = await supabase.from('community_posts').insert({
            author_id: user.id,
            caption: caption || null,
            image_url: imageUrls[0] || null,
            images_urls: imageUrls.length > 0 ? imageUrls : null,
            linked_activity_id: linkedActivityId || null,
        });

        if (error) throw error;
        await fetchFeed();
    };

    const updatePost = async (postId: string, caption: string, newLocalUris: string[], retainedExistingUrls: string[], linkedActivityId?: string) => {
        if (!user) return;

        let newUploadedUrls: string[] = [];
        if (newLocalUris.length > 0) {
            newUploadedUrls = await storageService.uploadCommunityImages(user.id, newLocalUris);
        }

        const finalImageUrls = [...retainedExistingUrls, ...newUploadedUrls];

        const { error } = await supabase.from('community_posts').update({
            caption: caption || null,
            image_url: finalImageUrls[0] || null,
            images_urls: finalImageUrls.length > 0 ? finalImageUrls : null,
            linked_activity_id: linkedActivityId || null,
        }).eq('id', postId).eq('author_id', user.id);

        if (error) throw error;
        await fetchFeed();
    };

    const deletePost = async (postId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('community_posts').delete().eq('id', postId).eq('author_id', user.id);
            if (error) throw error;
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (e: any) {
            console.warn('Error deleting post:', e.message || e);
        }
    };

    const reportPost = async (postId: string, reason: string) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('community_reports').insert({
                post_id: postId,
                reporter_id: user.id,
                reason: reason,
                status: 'pending' // Default value in DB, defined here for clarity
            });
            if (error) throw error;
        } catch (e: any) {
            console.warn('Error reporting post:', e.message || e);
        }
    };

    const toggleReaction = async (postId: string, reaction: ReactionType) => {
        if (!user) return;

        // Check if reaction already exists
        const existingPost = posts.find(p => p.id === postId);
        const existingReaction = existingPost?.reactions?.find(
            r => r.user_id === user.id && r.reaction === reaction
        );

        // Fast Optimistic Update using previous state for rollback capability
        const previousPosts = [...posts];

        try {
            if (existingReaction) {
                // Optimistic Remove
                setPosts(prev => prev.map(p => p.id !== postId ? p : {
                    ...p, reactions: p.reactions?.filter(r => r.id !== existingReaction.id) || []
                }));

                // Network request
                const { error } = await supabase.from('post_reactions').delete().eq('id', existingReaction.id);
                if (error) throw error;

            } else {
                // Optimistic Add (with temporary ID)
                const tempReaction: PostReaction = {
                    id: `temp_${Date.now()}`,
                    post_id: postId,
                    user_id: user.id,
                    reaction: reaction,
                    created_at: new Date().toISOString()
                };

                setPosts(prev => prev.map(p => p.id !== postId ? p : {
                    ...p, reactions: [...(p.reactions || []), tempReaction]
                }));

                // Network request
                const { data, error } = await supabase
                    .from('post_reactions')
                    .insert({ post_id: postId, user_id: user.id, reaction })
                    .select()
                    .single();

                if (error) throw error;

                // Replace temp reaction with the real one from DB to get the correct ID
                if (data) {
                    setPosts(prev => prev.map(p => p.id !== postId ? p : {
                        ...p, reactions: p.reactions?.map(r => r.id === tempReaction.id ? data as PostReaction : r) || []
                    }));
                }
            }
        } catch (error: any) {
            console.warn('Error toggling reaction:', error?.message || error);
            // Rollback optimistic update on failure
            setPosts(previousPosts);
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
        <CommunityContext.Provider value={{ posts, isLoading, fetchFeed, createPost, updatePost, deletePost, reportPost, toggleReaction }}>
            {children}
        </CommunityContext.Provider>
    );
}

export function useCommunity() {
    const ctx = useContext(CommunityContext);
    if (!ctx) throw new Error('useCommunity must be inside CommunityProvider');
    return ctx;
}
