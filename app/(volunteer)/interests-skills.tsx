import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../components/StandardLayout";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { useState } from "react";
import { ArrowLeft, Users, Globe, BookOpen, Dog, Palette, Heart, Code, MessageSquare, Lightbulb, PenTool, BarChart, HardHat, Camera, Save, TreePine } from "lucide-react-native";
import { SKILLS } from "../../constants/Skills";

const INTERESTS = [
    { id: "social", label: "Sociale", icon: Users },
    { id: "environment", label: "Ambiente", icon: TreePine },
    { id: "education", label: "Educazione", icon: BookOpen },
    { id: "animals", label: "Animali", icon: Dog },
    { id: "art", label: "Arte & Cultura", icon: Palette },
    { id: "health", label: "Salute", icon: Heart },
];

export default function InterestsSkillsSettings() {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();

    const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
    const [selectedSkills, setSelectedSkills] = useState<string[]>(user?.skills || []);
    const [saving, setSaving] = useState(false);

    const toggleInterest = (id: string) => {
        setSelectedInterests(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSkill = (id: string) => {
        setSelectedSkills(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateUserProfile({
                interests: selectedInterests,
                skills: selectedSkills
            });
            router.back();
        } catch (error) {
            console.error("Failed to save settings", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <StandardLayout
            label="Impostazioni"
            title="Interessi e Competenze"
            bg="bg-background-light"
            onBack={() => router.back()}
        >
            <View className="mb-8">
                <View className="mb-6">
                    <Text className="text-2xl font-black text-primary mb-2">I tuoi Interessi</Text>
                    <Text className="text-secondary">Le cause che ti stanno a cuore.</Text>
                </View>

                <View className="flex-row flex-wrap justify-between gap-y-3">
                    {INTERESTS.map((item) => {
                        const isSelected = selectedInterests.includes(item.label);
                        const Icon = item.icon;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => toggleInterest(item.label)}
                                className={`flex-col items-center justify-center px-1.5 py-3 rounded-xl border w-[31%] ${isSelected
                                    ? "bg-accent/10 border-accent/10"
                                    : "bg-white border-slate-200 shadow-sm"
                                    }`}
                                style={{ gap: 6 }}
                            >
                                <Icon size={20} color={isSelected ? Colors.accent : "#94a3b8"} />
                                <Text 
                                    className={`font-bold text-[11px] text-center ${isSelected ? "text-accent" : "text-slate-500"}`} 
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.7}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View className="mb-32">
                <View className="mb-6">
                    <Text className="text-2xl font-black text-primary mb-2">Le tue Competenze</Text>
                    <Text className="text-secondary">Le abilità che metti a disposizione.</Text>
                </View>

                <View className="flex-row flex-wrap justify-between gap-y-3">
                    {SKILLS.map((item) => {
                        const isSelected = selectedSkills.includes(item.label);
                        const Icon = item.icon;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => toggleSkill(item.label)}
                                className={`flex-col items-center justify-center px-1.5 py-3 rounded-xl border w-[31%] ${isSelected
                                    ? "bg-primary/10 border-primary/10"
                                    : "bg-white border-slate-200 shadow-sm"
                                    }`}
                                style={{ gap: 6 }}
                            >
                                <Icon size={20} color={isSelected ? Colors.primary : "#94a3b8"} />
                                <Text 
                                    className={`font-bold text-[11px] text-center ${isSelected ? "text-primary" : "text-slate-500"}`} 
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.7}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Bottom Save Button (Floating) */}
            <View className="absolute bottom-6 left-0 right-0">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    className={`py-4 rounded-2xl shadow-xl flex-row justify-center items-center gap-2 ${saving ? "bg-gray-300" : "bg-primary"
                        }`}
                >
                    <Save size={20} color="white" />
                    <Text className="text-white text-lg font-black">Salva Modifiche</Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}
