// types/community.ts

export interface CommunityPost {
    id: string;
    author_id: string;
    caption: string | null;
    image_url: string | null;
    linked_activity_id: string | null;
    created_at: string;
    // Joined fields
    author?: {
        id: string;
        name: string;
        npo_name: string | null;
        avatar: string | null;
        role: string;
    };
    linked_activity?: {
        id: string;
        title: string;
        date_time: string;
        status: string;
    } | null;
    reactions?: PostReaction[];
}

export interface PostReaction {
    id: string;
    post_id: string;
    user_id: string;
    reaction: 'heart' | 'clap' | 'muscle' | 'tree';
    created_at: string;
}

export type ReactionType = 'heart' | 'clap' | 'muscle' | 'tree';

export const REACTION_EMOJI: Record<ReactionType, string> = {
    heart: '❤️',
    clap: '🙌',
    muscle: '💪',
    tree: '🌳',
};
