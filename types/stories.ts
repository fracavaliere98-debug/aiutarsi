export interface Story {
    id: string;
    author_id: string;
    image_url: string;
    caption: string | null;
    linked_activity_id: string | null;
    expires_at: string;
    created_at: string;
    // Joined
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
        date_start: string;
        status: string;
    } | null;
}
