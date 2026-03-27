import { BookOpen, Dog, Heart, Palette, TreePine, Users } from "lucide-react-native";

export interface InterestItem {
    id: string;
    label: string;
    emoji: string;
    icon: any;
    description?: string;
    uri?: string;
}

export const INTERESTS: InterestItem[] = [
    {
        id: "ambiente",
        label: "Ambiente",
        emoji: "🌿",
        icon: TreePine,
        description: "Salvaguardia del territorio e natura",
        uri: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "sociale",
        label: "Sociale",
        emoji: "🤝",
        icon: Users,
        description: "Inclusione e supporto alla comunità",
        uri: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "educazione",
        label: "Educazione",
        emoji: "📚",
        icon: BookOpen,
        description: "Supporto scolastico e formazione",
        uri: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "animali",
        label: "Animali",
        emoji: "🐶",
        icon: Dog,
        description: "Cura e tutela dei nostri amici",
        uri: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "arte",
        label: "Arte & Cultura",
        emoji: "🎨",
        icon: Palette,
        description: "Promozione della bellezza e storia",
        uri: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop",
    },
    {
        id: "salute",
        label: "Salute",
        emoji: "💚",
        icon: Heart,
        description: "Prevenzione e assistenza sanitaria",
        uri: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop",
    },
];

export const ACTIVITY_CATEGORIES = INTERESTS.map((interest) => interest.label);
