import { 
    Heart, HeartPulse, BookOpen, Package, Wrench, Utensils, 
    Smartphone, Palette, PenTool, Briefcase, Monitor, Globe, 
    PawPrint, Trophy, LucideIcon 
} from 'lucide-react-native';

export interface SkillItem {
    id: string;
    label: string;
    icon: LucideIcon;
    /** Emoji piena, per contesti che seguono il mockup approvato (es. chip Competenze in ActivityForm)
     * invece delle icone line-art di Lucide usate altrove (onboarding, dettaglio attività, ecc.). */
    emoji: string;
}

export const SKILLS: SkillItem[] = [
    { id: "assistenza", label: "Assistenza", icon: Heart, emoji: "💪" },
    { id: "sanitario", label: "Sanitario", icon: HeartPulse, emoji: "🩹" },
    { id: "educazione", label: "Educazione", icon: BookOpen, emoji: "📚" },
    { id: "logistica", label: "Logistica", icon: Package, emoji: "🚚" },
    { id: "ambiente", label: "Ambiente", icon: Wrench, emoji: "🌿" },
    { id: "cucina", label: "Cucina", icon: Utensils, emoji: "🍲" },
    { id: "digital", label: "Digital", icon: Smartphone, emoji: "📱" },
    { id: "creativita", label: "Creatività", icon: Palette, emoji: "🎨" },
    { id: "scrittura", label: "Scrittura", icon: PenTool, emoji: "🗣️" },
    { id: "amministrazione", label: "Amministrazione", icon: Briefcase, emoji: "📋" },
    { id: "tecnologia", label: "Tecnologia", icon: Monitor, emoji: "💻" },
    { id: "lingue", label: "Lingue", icon: Globe, emoji: "🌍" },
    { id: "animali", label: "Animali", icon: PawPrint, emoji: "🐾" },
    { id: "sport", label: "Sport", icon: Trophy, emoji: "🏆" },
];

export const getSkillIcon = (label: string): LucideIcon => {
    const skill = SKILLS.find((s) => s.label === label || s.id === label);
    return skill ? skill.icon : Heart; // Default icon if not found
};
