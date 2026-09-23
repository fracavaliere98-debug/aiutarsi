import {
    Heart, HeartPulse, BookOpen, Wrench, Utensils,
    Smartphone, Palette, Monitor, Globe,
    PawPrint, Trophy, HeartHandshake, LucideIcon
} from 'lucide-react-native';
import { SKILL_TAXONOMY } from '../shared/skillsTaxonomy';

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
 * Id e label canonici vivono in shared/skillsTaxonomy.ts (fonte unica, letta anche dalla edge
 * function activity-curator-ai): qui si attacca solo la parte visuale, solo-app (icona Lucide +
 * emoji), che una edge function Deno non potrebbe importare. Se aggiungi/rinomini una competenza,
 * parti da shared/skillsTaxonomy.ts — non da qui.
 */
const SKILL_VISUALS: Record<string, { icon: LucideIcon; emoji: string }> = {
    "assistenza-persona": { icon: Heart, emoji: "💪" },
    "primo-soccorso": { icon: HeartPulse, emoji: "🩹" },
    "insegnamento": { icon: BookOpen, emoji: "📚" },
    "manualita": { icon: Wrench, emoji: "🛠️" },
    "cura-animali": { icon: PawPrint, emoji: "🐾" },
    "cucina": { icon: Utensils, emoji: "🍲" },
    "comunicazione-digitale": { icon: Smartphone, emoji: "📱" },
    "informatica": { icon: Monitor, emoji: "💻" },
    "creativita": { icon: Palette, emoji: "🎨" },
    "ascolto-compagnia": { icon: HeartHandshake, emoji: "🤝" },
    "lingue": { icon: Globe, emoji: "🌍" },
    "sport": { icon: Trophy, emoji: "🏆" },
};

export const SKILLS: SkillItem[] = SKILL_TAXONOMY.map((skill) => {
    const visuals = SKILL_VISUALS[skill.id];
    if (!visuals) {
        // Nessun fallback silenzioso: una competenza senza icona/emoji assegnata deve rompere
        // subito in dev, non finire con un'icona a caso in produzione.
        throw new Error(`constants/Skills.ts: nessuna icona/emoji assegnata per l'id "${skill.id}" (presente in shared/skillsTaxonomy.ts)`);
    }
    return { id: skill.id, label: skill.label, icon: visuals.icon, emoji: visuals.emoji };
});

export const getSkillIcon = (idOrLabel: string): LucideIcon => {
    const skill = SKILLS.find((s) => s.id === idOrLabel || s.label === idOrLabel);
    return skill ? skill.icon : Heart; // Default icon if not found
};

export const getSkillLabel = (idOrLabel: string): string => {
    const skill = SKILLS.find((s) => s.id === idOrLabel || s.label === idOrLabel);
    return skill ? skill.label : idOrLabel;
};
