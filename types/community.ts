// types/community.ts

import { Database } from './supabase';
import { Activity, User } from './index';

export type PostReaction = Database['public']['Tables']['post_reactions']['Row'];

export type CommunityPost = Database['public']['Tables']['community_posts']['Row'] & {
    // Joined fields
    author?: {
        id: string;
        full_name: string | null;
        npo_name: string | null;
        avatar_url: string | null;
        role: string;
    } | null;
    linked_activity?: {
        id: string;
        title: string;
        date_start: string;
        status: string | null;
    } | null;
    reactions?: PostReaction[];
};

export type ReactionType = 'heart' | 'clap' | 'muscle' | 'tree';


export const REACTION_EMOJI: Record<ReactionType, string> = {
    heart: '❤️',
    clap: '🙌',
    muscle: '💪',
    tree: '🌳',
};
