import { 
    Heart, HeartPulse, BookOpen, Package, Wrench, Utensils, 
    Smartphone, Palette, PenTool, Briefcase, Monitor, Globe, 
    PawPrint, Trophy, LucideIcon 
} from 'lucide-react-native';

export interface SkillItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

export const SKILLS: SkillItem[] = [
    { id: "assistenza", label: "Assistenza", icon: Heart },
    { id: "sanitario", label: "Sanitario", icon: HeartPulse },
    { id: "educazione", label: "Educazione", icon: BookOpen },
    { id: "logistica", label: "Logistica", icon: Package },
    { id: "ambiente", label: "Ambiente", icon: Wrench },
    { id: "cucina", label: "Cucina", icon: Utensils },
    { id: "digital", label: "Digital", icon: Smartphone },
    { id: "creativita", label: "Creatività", icon: Palette },
    { id: "scrittura", label: "Scrittura", icon: PenTool },
    { id: "amministrazione", label: "Amministrazione", icon: Briefcase },
    { id: "tecnologia", label: "Tecnologia", icon: Monitor },
    { id: "lingue", label: "Lingue", icon: Globe },
    { id: "animali", label: "Animali", icon: PawPrint },
    { id: "sport", label: "Sport", icon: Trophy },
];

export const getSkillIcon = (label: string): LucideIcon => {
    const skill = SKILLS.find((s) => s.label === label || s.id === label);
    return skill ? skill.icon : Heart; // Default icon if not found
};
