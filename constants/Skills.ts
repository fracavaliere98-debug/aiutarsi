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
    { id: "assistenza", label: "Assistenza e Compagnia", icon: Heart },
    { id: "sanitario", label: "Supporto Sanitario e Soccorso", icon: HeartPulse },
    { id: "educazione", label: "Educazione e Mentoring", icon: BookOpen },
    { id: "logistica", label: "Logistica e Distribuzione", icon: Package },
    { id: "ambiente", label: "Manutenzione e Ambiente", icon: Wrench },
    { id: "cucina", label: "Cucina e Mensa", icon: Utensils },
    { id: "digital", label: "Digital & Social Media", icon: Smartphone },
    { id: "creativita", label: "Creatività e Grafica", icon: Palette },
    { id: "scrittura", label: "Scrittura e Storytelling", icon: PenTool },
    { id: "amministrazione", label: "Amministrazione e Gestione", icon: Briefcase },
    { id: "tecnologia", label: "Tecnologia e IT", icon: Monitor },
    { id: "lingue", label: "Lingue e Traduzioni", icon: Globe },
    { id: "animali", label: "Tutela Animali", icon: PawPrint },
    { id: "sport", label: "Sport per il Sociale", icon: Trophy },
];

export const getSkillIcon = (label: string): LucideIcon => {
    const skill = SKILLS.find((s) => s.label === label || s.id === label);
    return skill ? skill.icon : Heart; // Default icon if not found
};
