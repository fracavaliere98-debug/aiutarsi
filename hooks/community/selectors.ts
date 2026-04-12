import { CommunityPost, PostReaction, ReactionType } from "../../types/community";

export function getCommunityPostImageUrls(post: CommunityPost): string[] {
    if (post.images_urls && post.images_urls.length > 0) {
        return post.images_urls;
    }

    return post.image_url ? [post.image_url] : [];
}

export function getCommunityAuthorName(post: CommunityPost): string {
    return post.author?.npo_name || post.author?.full_name || "NPO";
}

export function getCommunityReactionSnapshot(post: CommunityPost, userId?: string) {
    const reactionCounts: Record<ReactionType, number> = { heart: 0, clap: 0, muscle: 0, tree: 0 };
    const userReactions = new Set<ReactionType>();

    for (const reaction of (post.reactions || []) as PostReaction[]) {
        const reactionType = reaction.reaction as ReactionType;
        if (reactionType in reactionCounts) {
            reactionCounts[reactionType] += 1;
            if (userId && reaction.user_id === userId) {
                userReactions.add(reactionType);
            }
        }
    }

    return { reactionCounts, userReactions };
}
