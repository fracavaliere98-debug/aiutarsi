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

// --- APP USER TYPE (Successor to OldUser) ---
export type AppUser = User & {
    user_skills?: UserSkill[];
    user_interests?: UserInterest[];
    followed_entities?: { npo_id: string }[];
    // Backward compatibility for UI & convenience
    name: string;
    avatar?: string;
    impactPoints: number;
    npoName?: string;
    companyName?: string;
    skills: string[];
    interests: string[];
    followedNPOs: string[];
    password?: string;
    locationCoords?: { lat: number; lng: number };
    profileCompleted?: boolean;
    isVerified?: boolean;
    publicEmail?: string;
    lastSeenAt?: string;
    createdAt?: string;
};

// Hybrid / Frontend-only Extended Types
export type ActivityWithDistance = Activity & { distanceMeters?: number };

// --- APP ACTIVITY TYPE (Successor to OldActivity) ---
export type AppActivity = Activity & {
    profiles?: {
        npo_name?: string | null;
        full_name?: string | null;
        avatar_url?: string | null;
    } | null;
    activity_participants?: { user_id: string }[] | null;
    activity_skills?: { skill: string }[] | null;

    // Legacy mapping for UI
    npoName: string;
    npoId: string;         // maps to npo_id
    dateTime: string;      // maps to date_start
    endDateTime: string;   // maps to date_end
    imageUrl?: string;     // maps to image_url
    iscritti: string[];    // maps to user_ids from activity_participants
    skills: string[];      // maps to skills from activity_skills
    matchPercentage?: number;
    slots: number;         // maps to total_slots
    category: string;      // maps to category
    isUrgent: boolean;     // maps to is_urgent
    location: {
        address: string;
        coords: { lat: number, lng: number };
    };
};

export type AppActivityApplication = OldActivityApplication;

export type Role = "VOLUNTEER" | "NPO" | "CORPORATE";

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
    profileCompleted?: boolean;
    lastSeenAt?: string;
    createdAt?: string;
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
}
