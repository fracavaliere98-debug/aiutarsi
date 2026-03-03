export type Role = "VOLUNTEER" | "NPO" | "CORPORATE";

export interface User {
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

export interface Activity {
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

export interface Review {
    id: string;
    activityId: string;
    npoId: string;
    volunteerId: string;
    stars: number;
    comment: string;
    feelings: string[];
    date: string;
}

export interface VolunteerReview {
    id: string;
    activityId: string;
    npoId: string;
    volunteerId: string;
    isPresent: boolean;
    stars?: number;
    comment?: string;
    date: string;
}

export interface ActivityApplication {
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

export interface Application {
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

export interface Candidature {
    id: string;
    projectId: string;
    volunteerId: string;
    volunteerName: string;
    volunteerAvatar: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    date: string;
    message?: string;
}

export interface Employee {
    id: string;
    name: string;
    avatar: string;
    impactPoints: number;
    hoursVolunteered: number;
    department: string;
}
