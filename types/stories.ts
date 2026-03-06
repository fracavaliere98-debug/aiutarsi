import { Database } from './supabase';

export type Story = Database['public']['Tables']['stories']['Row'] & {
    // Joined
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
};

