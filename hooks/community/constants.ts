export const COMMUNITY_FEED_PAGE_SIZE = 30;
export const COMMUNITY_ACTIVITY_POSTS_LIMIT = 20;

export const COMMUNITY_POST_SELECT = `
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
`;
