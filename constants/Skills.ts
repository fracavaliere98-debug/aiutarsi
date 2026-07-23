import {
    Heart, HeartPulse, BookOpen, Wrench, Utensils,
    Smartphone, Palette, Monitor, Globe,
    PawPrint, Trophy, HeartHandshake, LucideIcon
} from 'lucide-react-native';

export interface SkillItem {
    id: string;
    label: string;
    icon: LucideIcon;
    /** Emoji piena, per contesti che seguono il mockup approvato (es. chip Competenze in ActivityForm)
     * invece delle icone line-art di Lucide usate altrove (onboarding, dettaglio attività, ecc.). */
    emoji: string;
}

/**
 * Competenze reali che una persona può avere, distinte dalle categorie/settori in cui le NPO
 * dichiarano di operare (vedi constants/Interests.ts: Ambiente, Sociale, Educazione, Animali,
 * Arte & Cultura, Salute). Nessuna etichetta qui ripete letteralmente il nome di una categoria —
 * es. non "Educazione" ma "Insegnamento e tutoraggio", non "Ambiente" ma "Manualità e lavori
 * pratici" — così che nei filtri/chip dell'app le due liste restino sempre distinguibili.
 *
 * L'id è la chiave stabile usata ovunque per salvare/confrontare le competenze (profilo
 * volontario, competenze cercate da un ente, competenze richieste da un'attività, Smart Match):
 * MAI la label, che può cambiare copy senza rompere i confronti. Rinominata qui il 2026-07-23 —
 * vedi supabase/migrations/20260723120000_rationalize_skills_taxonomy.sql per il backfill dei
 * valori legacy già salvati in user_skills/sought_skills/activity_skills.
 */
export const SKILLS: SkillItem[] = [
    { id: "assistenza-persona", label: "Assistenza alla persona", icon: Heart, emoji: "💪" },
    { id: "primo-soccorso", label: "Primo soccorso", icon: HeartPulse, emoji: "🩹" },
    { id: "insegnamento", label: "Insegnamento e tutoraggio", icon: BookOpen, emoji: "📚" },
    { id: "manualita", label: "Manualità e lavori pratici", icon: Wrench, emoji: "🛠️" },
    { id: "cura-animali", label: "Cura degli animali", icon: PawPrint, emoji: "🐾" },
    { id: "cucina", label: "Cucina", icon: Utensils, emoji: "🍲" },
    { id: "comunicazione-digitale", label: "Comunicazione e social media", icon: Smartphone, emoji: "📱" },
    { id: "informatica", label: "Competenze informatiche", icon: Monitor, emoji: "💻" },
    { id: "creativita", label: "Creatività e grafica", icon: Palette, emoji: "🎨" },
    { id: "ascolto-compagnia", label: "Ascolto e compagnia", icon: HeartHandshake, emoji: "🤝" },
    { id: "lingue", label: "Lingue straniere", icon: Globe, emoji: "🌍" },
    { id: "sport", label: "Sport", icon: Trophy, emoji: "🏆" },
];

export const getSkillIcon = (idOrLabel: string): LucideIcon => {
    const skill = SKILLS.find((s) => s.id === idOrLabel || s.label === idOrLabel);
    return skill ? skill.icon : Heart; // Default icon if not found
};

export const getSkillLabel = (idOrLabel: string): string => {
    const skill = SKILLS.find((s) => s.id === idOrLabel || s.label === idOrLabel);
    return skill ? skill.label : idOrLabel;
};
