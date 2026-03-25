import { Database } from './supabase';

// --- NEW SUPABASE DERIVED TYPES (Single Source of Truth) ---
export type Activity = Database['public']['Tables']['activities']['Row'];
export type InsertActivity = Database['public']['Tables']['activities']['Insert'];
export type User = Database['public']['Tables']['profiles']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type VolunteerReview = Database['public']['Tables']['volunteer_reviews']['Row'];
export type Application = Database['public']['Tables']['applications']['Row'];
export type ActivityParticipant = Database['public']['Tables']['activity_participants']['Row'];
export type CommunityPostRow = Database['public']['Tables']['community_posts']['Row'];
export type PostReactionRow = Database['public']['Tables']['post_reactions']['Row'];
export type StoryRow = Database['public']['Tables']['stories']['Row'];
export type UserSkill = Database['public']['Tables']['user_skills']['Row'];
export type UserInterest = Database['public']['Tables']['user_interests']['Row'];
export type NPOFollower = Database['public']['Tables']['npo_followers']['Row'];

export interface Badge {
    id: string;
    name: string;
    icon: string;
    description: string;
    dateEarned: string;
    color: string;
}

// --- APP USER TYPE (Successor to OldUser) ---
export type AppUser = Omit<User,
    'email' | 'bio' | 'phone' | 'website' | 'public_email' | 'location_string' |
    'npo_name' | 'company_name' | 'is_verified' | 'profile_public' |
    'show_email' | 'allow_calls' | 'show_volunteering_history' | 'volunteer_list_visible' |
    'embedding' | 'updated_at' | 'created_at' | 'last_seen_at' | 'expo_push_token' | 'referral_code' | 'referred_by'
> & {
    email: string;
    user_skills?: UserSkill[];
    user_interests?: UserInterest[];
    followed_entities?: { npo_id: string }[];
    // Backward compatibility for UI & convenience
    name: string;
    avatar: string;
    impactPoints: number;
    bio?: string;
    phone?: string;
    website?: string;
    npoName?: string;
    companyName?: string;
    isVerified?: boolean;
    locationString?: string;
    publicEmail?: string;
    profile_public?: boolean;
    show_email?: boolean;
    allow_calls?: boolean;
    show_volunteering_history?: boolean;
    volunteer_list_visible?: boolean;
    skills: string[];
    interests: string[];
    followedNPOs: string[];
    password?: string;
    locationCoords?: { lat: number; lng: number };
    lastSeenAt?: string;
    createdAt?: string;
    badges?: Badge[];
    xp?: number;
    shortId?: string;
    deletionRequestedAt: string | null;
    // Database field aliases (for mappings)
    verification_status?: 'none' | 'pending' | 'verified' | 'rejected';
    npo_vat_id?: string | null;
    npo_website?: string | null;
    referent_name?: string | null;
    referent_role?: string | null;
    referent_avatar_url?: string | null;
    auto_welcome_message?: string | null;
    address_full?: string | null;
    sought_skills?: string[] | null;
    verification_doc_url?: string | null;
    npo_name?: string | null;
    company_name?: string | null;
    is_verified?: boolean | null;
    location_string?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    public_email?: string | null;
    profile_completed: boolean;
    last_seen_at?: string | null;
    expo_push_token?: string | null;
    created_at?: string;
    updated_at?: string;
    embedding?: number[] | null;
    deletion_requested_at?: string | null;
    is_banned?: boolean | null;
    ban_reason?: string | null;
    ban_report_id?: string | null;
    referral_code?: string | null;
    referred_by?: string | null;
};

// Hybrid / Frontend-only Extended Types
export type ActivityWithDistance = AppActivity & { distanceMeters?: number };

// --- APP ACTIVITY TYPE (Successor to OldActivity) ---
export type AppActivity = Omit<Activity,
    'date_end' | 'date_start' | 'image_url' | 'location_address' | 'location_coords' |
    'location_lat' | 'location_lng' | 'npo_id' | 'slots_total' | 'status' | 'recurrence' |
    'created_at' | 'embedding' | 'updated_at' | 'match_percentage' | 'npo_name' | 'is_urgent' | 'description' | 'category' | 'title'
> & {
    id: string;
    title: string;
    description: string;
    category: string;
    npoId: string;
    npoName: string;
    status: string;
    iscritti: string[];
    location: {
        coords: { lat: number; lng: number };
        address: string;
    };
    dateTime: string;
    endDateTime: string;
    slots: number;
    imageUrl?: string;
    skills: string[];
    isUrgent: boolean;
    matchPercentage?: number;
    recurrence?: 'NONE' | 'WEEKLY' | 'MONTHLY';
    profiles?: {
        npo_name?: string | null;
        full_name?: string | null;
        avatar_url?: string | null;
        is_verified?: boolean | null;
    } | null;
    activity_participants?: { user_id: string }[] | null;
    activity_skills?: { skill: string }[] | null;
};

export type AppActivityApplication = OldActivityApplication;

export type Role = "VOLUNTEER" | "NPO" | "CORPORATE" | "ADMIN";

export interface OldUser {
    id: string;
    email: string;
    password?: string;
    name: string;
    role: Role;
    avatar: string;
    impactPoints: number;
    shortId?: string; // 8-character readable ID
    skills: string[];
    interests: string[];
    // NPO specific
    npoName?: string;
    // Corporate specific
    companyName?: string;
    isVerified?: boolean;
    locationCoords?: { lat: number, lng: number };
    locationString?: string;
    // Volunteer specific - NPOs this volunteer follows
    followedNPOs?: string[];
    // Extended profile fields
    bio?: string;
    phone?: string;
    website?: string;
    publicEmail?: string; // Contact email, distinct from login email
    profile_public?: boolean;
    show_email?: boolean;
    allow_calls?: boolean;
    profile_completed: boolean;
    lastSeenAt?: string;
    createdAt?: string;
    badges?: Badge[];
    xp?: number;
    embedding?: number[];
}

export interface OldActivity {
    id: string;
    npoId: string; // Autore_NPO
    npoName: string;
    title: string;
    dateTime: string; // Data_Ora Inizio
    endDateTime: string; // Data_Ora Fine
    location: {
        coords: { lat: number, lng: number };
        address: string;
    };
    slots: number; // Slot_Disponibili
    category: string; // Categoria
    skills: string[]; // required skills
    description: string;
    status: "APERTA" | "IN_CORSO" | "COMPLETATA" | "CANCELLATA";
    iscritti: string[]; // Array di ID_Volontari
    matchPercentage: number;
    isUrgent: boolean;
    imageUrl?: string;
    npoEmail?: string;
    embedding?: number[];
    recurrence?: 'NONE' | 'WEEKLY' | 'MONTHLY'; // Recurring activity
}

export interface OldReview {
    id: string;
    activityId: string;
    npoId: string;
    volunteerId: string;
    stars: number;
    comment: string;
    feelings: string[];
    date: string;
}

export interface OldVolunteerReview {
    id: string;
    activityId: string;
    npoId: string;
    volunteerId: string;
    isPresent: boolean;
    stars?: number;
    comment?: string;
    date: string;
}

export interface OldActivityApplication {
    id: string;
    activityId: string;
    volunteerId: string;
    volunteerName: string;
    volunteerAvatar?: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "REGISTERED";
    appliedDate: string;
    message?: string;
    phone?: string;
}

export interface OldApplication {
    id: string;
    npoId: string;
    npoName: string;
    volunteerId: string;
    volunteerName: string;
    volunteerAvatar: string;
    message: string;
    skills: string[];
    status: "PENDING" | "APPROVED" | "REJECTED";
    appliedDate: string;
    reviewedDate?: string;
}

export interface OldCandidature {
    id: string;
    projectId: string;
    volunteerId: string;
    volunteerName: string;
    volunteerAvatar: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    date: string;
    message?: string;
}

export interface OldEmployee {
    id: string;
    name: string;
    avatar: string;
    impactPoints: number;
    hoursVolunteered: number;
    department: string;
}

export interface OldSmartMatchResult {
    id: string;
    score: number;
    reason: string;
    activity?: OldActivity;
    confidence?: 'top' | 'good' | 'explore';
    confidenceLabel?: string;
    chips?: string[];
    nextStep?: string;
    saved?: boolean;
    liked?: boolean;
    seen?: boolean;
}
