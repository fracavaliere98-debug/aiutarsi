export type Role = "VOLUNTEER" | "NPO" | "CORPORATE";

export interface User {
    id: string;
    email: string;
    password?: string;
    name: string;
    role: Role;
    avatar: string;
    impactPoints: number;
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
    profileCompleted?: boolean;
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

export interface ActivityApplication {
    id: string;
    activityId: string;
    volunteerId: string;
    volunteerName: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    appliedDate: string;
    message?: string;
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

// Initial Mock Users
export const INITIAL_USERS: User[] = [
    {
        id: "vol_rossi_alessandro",
        email: "volontario@test.com",
        password: "password",
        name: "Alessandro Rossi",
        role: "VOLUNTEER",
        avatar: "https://i.pravatar.cc/150?img=11",
        impactPoints: 120,
        skills: ["Insegnamento", "Logistica", "Cucina"],
        interests: ["Sociale", "Educazione"],
        isVerified: true,
        locationCoords: { lat: 45.470, lng: 9.180 },
        profileCompleted: true
    },
    {
        id: "npo_prova",
        email: "npo",
        password: "npo",
        name: "Gestore NPO",
        role: "NPO",
        npoName: "NPOPROVA",
        avatar: "https://i.pravatar.cc/150?img=5",
        impactPoints: 0,
        skills: [],
        interests: [],
        publicEmail: "contatti@npoprova.org",
        phone: "+39 02 1234567",
        website: "https://www.npoprova.org",
        bio: "Siamo un'organizzazione dedicata al supporto della comunità locale attraverso iniziative di volontariato e solidarietà.",
        locationString: "Via Roma 10, Milano"
    },
    {
        id: "corp_tech_solutions",
        email: "corporate@test.com",
        password: "password",
        name: "Tech Solutions HR",
        role: "CORPORATE",
        companyName: "Tech Solutions S.p.A.",
        avatar: "https://i.pravatar.cc/150?img=3",
        impactPoints: 4500,
        skills: [],
        interests: [],
    },
    {
        id: "vol_ter_ter",
        email: "ter",
        password: "ter",
        name: "Ter Ter",
        role: "VOLUNTEER",
        avatar: "https://i.pravatar.cc/150?img=15",
        impactPoints: 85,
        skills: ["Comunicazione", "Organizzazione"],
        interests: ["Sociale", "Ambiente"],
        isVerified: true,
        locationCoords: { lat: 45.464, lng: 9.190 },
        profileCompleted: true
    },
    {
        id: "vol_neri_marco",
        email: "marco@test.com",
        password: "password",
        name: "Marco Neri",
        role: "VOLUNTEER",
        avatar: "https://i.pravatar.cc/300?img=33",
        impactPoints: 1250,
        skills: ["Insegnamento", "Cucina", "Primo Soccorso"],
        interests: ["Ambiente", "Educazione", "Sanità"],
        bio: "Amo aiutare il prossimo e partecipare ad iniziative locali. Sono un insegnante in pensione con la passione per la cucina.",
        phone: "+39 333 9988777",
        locationCoords: { lat: 45.4642, lng: 9.1900 },
        locationString: "Milano, MI"
    },
    {
        id: "vol_test",
        email: "vol",
        password: "vol",
        name: "Volontario Test",
        role: "VOLUNTEER",
        avatar: "https://i.pravatar.cc/150?img=47",
        impactPoints: 0,
        skills: ["Tuttofare"],
        interests: ["Sociale"],
        isVerified: true,
        bio: "Sono un volontario di test per l'applicazione AiutarSi.",
        phone: "+39 000 1112233",
        locationCoords: { lat: 45.460, lng: 9.170 },
        locationString: "Milano, MI",
        profileCompleted: true
    },
];

export const MOCK_ACTIVITIES: Activity[] = [
    {
        id: "act_distribuzione_pasti",
        npoId: "npo_prova",
        npoName: "NPOPROVA",
        title: "Distribuzione Pasti Solidali (Conclusa)",
        dateTime: "2024-01-01T10:00:00Z",
        endDateTime: "2024-01-01T13:00:00Z",
        location: {
            coords: { lat: 45.464, lng: 9.190 },
            address: "Piazza Duomo, Milano"
        },
        slots: 5,
        category: "Sociale",
        description: "Attività di distribuzione pasti ai senzatetto nel centro di Milano. Grazie a tutti i partecipanti!",
        status: "COMPLETATA",
        iscritti: [],
        matchPercentage: 100,
        skills: []
    },
    {
        id: "act_pulizia_parco",
        npoId: "npo_prova",
        npoName: "NPOPROVA",
        title: "Pulizia Parco Sempione",
        dateTime: "2026-03-10T09:00:00Z",
        endDateTime: "2026-03-10T12:00:00Z",
        location: {
            coords: { lat: 45.472, lng: 9.179 },
            address: "Parco Sempione, Milano"
        },
        slots: 10,
        category: "Ambiente",
        description: "Unisciti a noi per una mattinata dedicata alla pulizia del parco più amato di Milano. Guanti e sacchi forniti.",
        status: "APERTA",
        iscritti: [],
        matchPercentage: 85,
        skills: ["Lavoro Manuale"]
    },
    {
        id: "act_supporto_digitale",
        npoId: "npo_prova",
        npoName: "NPOPROVA",
        title: "Supporto Digitale Anziani",
        dateTime: new Date(Date.now() - 3600000).toISOString(), // Started 1 hour ago
        endDateTime: new Date(Date.now() + 7200000).toISOString(), // Ends in 2 hours
        location: {
            coords: { lat: 45.480, lng: 9.200 },
            address: "Biblioteca Valvassori Peroni, Milano"
        },
        slots: 3,
        category: "Istruzione",
        description: "Corso di alfabetizzazione digitale per la terza età. Cerchiamo tutor pazienti.",
        status: "IN_CORSO",
        iscritti: [],
        matchPercentage: 90,
        skills: ["Informatica", "Comunicazione"]
    }
];

export const MOCK_REVIEWS: Review[] = [];

export const MOCK_CANDIDATURES: Candidature[] = [];

export const MOCK_EMPLOYEES: Employee[] = [
    {
        id: "e1",
        name: "Roberto Gialli",
        avatar: "https://i.pravatar.cc/150?img=68",
        impactPoints: 850,
        hoursVolunteered: 24,
        department: "Engineering"
    },
    {
        id: "e2",
        name: "Sofia Rosa",
        avatar: "https://i.pravatar.cc/150?img=44",
        impactPoints: 620,
        hoursVolunteered: 18,
        department: "Marketing"
    },
    {
        id: "e3",
        name: "Davide Marrone",
        avatar: "https://i.pravatar.cc/150?img=53",
        impactPoints: 540,
        hoursVolunteered: 15,
        department: "Sales"
    },
    {
        id: "e4",
        name: "Sara Viola",
        avatar: "https://i.pravatar.cc/150?img=32",
        impactPoints: 410,
        hoursVolunteered: 12,
        department: "Engineering"
    }
];
