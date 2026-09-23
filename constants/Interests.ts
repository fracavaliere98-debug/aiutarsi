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

export interface CategoryColorPair {
    bg: string;
    text: string;
}

/**
 * Palette Tailwind/NativeWind per le card categoria (es. Esplora). Chiave = InterestItem.id, non
 * la label, così resta stabile anche se cambia il copy (le label sono anche testo salvato in
 * activities.category, l'id no). Prima viveva come switch locale a mano in
 * app/(volunteer)/(tabs)/search.tsx (getCategoryColors), unico consumer: spostata qui, vicino
 * alla lista canonica delle categorie, per evitare che una nuova categoria in INTERESTS finisca
 * silenziosamente grigia (fallback) senza che nessuno se ne accorga. Il contract test in
 * scripts/test_category_colors_contract.ts fallisce se una voce di INTERESTS non ha un colore
 * esplicito qui.
 */
export const CATEGORY_COLORS: Record<string, CategoryColorPair> = {
    ambiente: { bg: "bg-emerald-100", text: "text-emerald-700" },
    sociale: { bg: "bg-blue-100", text: "text-blue-700" },
    educazione: { bg: "bg-purple-100", text: "text-purple-700" },
    animali: { bg: "bg-orange-100", text: "text-orange-700" },
    arte: { bg: "bg-indigo-100", text: "text-indigo-700" },
    salute: { bg: "bg-rose-100", text: "text-rose-700" },
};

/** Fallback per valori non riconosciuti (dati sporchi/legacy) — non per una categoria valida
 * mancante dalla mappa: quel caso è responsabilità del contract test, non di questo default. */
const DEFAULT_CATEGORY_COLORS: CategoryColorPair = { bg: "bg-slate-100", text: "text-slate-700" };

/** Colori per una categoria, cercata per label (es. "Ambiente", il valore salvato in
 * activities.category) o per id ("ambiente"). Case-insensitive per compatibilità con l'uso
 * precedente (il vecchio switch normalizzava in maiuscolo). */
export const getCategoryColors = (categoryLabelOrId?: string): CategoryColorPair => {
    if (!categoryLabelOrId) return DEFAULT_CATEGORY_COLORS;
    const normalized = categoryLabelOrId.trim().toLowerCase();
    const interest = INTERESTS.find(
        (i) => i.id.toLowerCase() === normalized || i.label.toLowerCase() === normalized
    );
    if (!interest) return DEFAULT_CATEGORY_COLORS;
    return CATEGORY_COLORS[interest.id] ?? DEFAULT_CATEGORY_COLORS;
};
