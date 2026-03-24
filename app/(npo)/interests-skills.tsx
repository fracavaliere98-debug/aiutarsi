import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../components/StandardLayout";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { useState } from "react";
import { Save, CheckCircle2 } from "lucide-react-native";
import { SKILLS } from "../../constants/Skills";
import { useToast } from "../../context/ToastContext";
import Animated, { FadeInDown } from "react-native-reanimated";

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { id: 'ambiente', label: 'Ambiente', emoji: '🌿' },
    { id: 'sociale', label: 'Sociale', emoji: '🤝' },
    { id: 'educazione', label: 'Educazione', emoji: '📚' },
    { id: 'animali', label: 'Animali', emoji: '🐶' },
    { id: 'arte', label: 'Arte & Cultura', emoji: '🎨' },
    { id: 'salute', label: 'Salute', emoji: '💚' },
];

export default function NPOInterestsSkillsSettings({ onClose }: { onClose?: () => void }) {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();
    const { showToast } = useToast();

    const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
    const [selectedSkills, setSelectedSkills] = useState<string[]>(user?.sought_skills || []);
    const [saving, setSaving] = useState(false);

    const toggleInterest = (label: string) => {
        setSelectedInterests(prev =>
            prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
        );
    };

    const toggleSkill = (label: string) => {
        setSelectedSkills(prev =>
            prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
        );
    };

    const handleSave = async () => {
        if (selectedInterests.length === 0 || selectedSkills.length === 0) {
            showToast("error", "Seleziona almeno un settore e una competenza.");
            return;
        }

        setSaving(true);
        try {
            await updateUserProfile({
                interests: selectedInterests,
                sought_skills: selectedSkills
            } as any);
            showToast("success", "Preferenze aggiornate!");
            if (onClose) {
                onClose();
            } else {
                router.back();
            }
        } catch (error) {
            console.error("Failed to save settings", error);
            showToast("error", "Errore durante il salvataggio.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <StandardLayout
            label="Impostazioni"
            title="Settori e Competenze"
            bg="bg-background-light"
            onBack={onClose || (() => router.back())}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* SETTORI SECTION */}
                <View className="mb-10">
                    <View className="mb-6">
                        <Text className="text-2xl font-black text-primary mb-2">Settori di Intervento</Text>
                        <Text className="text-secondary text-base">Le aree in cui opera il vostro ente.</Text>
                    </View>

                    <View className="flex-row flex-wrap justify-between gap-y-3">
                        {CATEGORIES.map((item, index) => {
                            const isSelected = selectedInterests.includes(item.label);
                            return (
                                <Animated.View 
                                    key={item.id} 
                                    entering={FadeInDown.delay(index * 50).springify()}
                                    style={{ width: (width - 48) / 2 - 8 }}
                                >
                                    <TouchableOpacity
                                        onPress={() => toggleInterest(item.label)}
                                        className={`flex-col items-center justify-center p-4 rounded-3xl border ${isSelected
                                            ? "bg-primary/10 border-primary/20"
                                            : "bg-white border-slate-200 shadow-sm"
                                            }`}
                                        style={{ aspectRatio: 1.1 }}
                                    >
                                        <Text style={{ fontSize: 32, marginBottom: 8 }}>{item.emoji}</Text>
                                        <Text 
                                            className={`font-black text-sm text-center ${isSelected ? "text-primary" : "text-slate-500"}`}
                                            numberOfLines={2}
                                        >
                                            {item.label}
                                        </Text>
                                        {isSelected && (
                                            <View className="absolute top-3 right-3">
                                                <CheckCircle2 size={18} color={Colors.primary} fill="white" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </View>
                </View>

                {/* SKILLS SECTION */}
                <View className="mb-8">
                    <View className="mb-6">
                        <Text className="text-2xl font-black text-primary mb-2">Competenze Ricercate</Text>
                        <Text className="text-secondary text-base">Cosa cercate solitamente nei volontari?</Text>
                    </View>

                    <View className="flex-row flex-wrap justify-between gap-y-3">
                        {SKILLS.map((item, index) => {
                            const isSelected = selectedSkills.includes(item.label);
                            const Icon = item.icon;
                            return (
                                <Animated.View 
                                    key={item.id} 
                                    entering={FadeInDown.delay(index * 30).springify()}
                                    style={{ width: (width - 48) / 3 - 6 }}
                                >
                                    <TouchableOpacity
                                        onPress={() => toggleSkill(item.label)}
                                        className={`flex-col items-center justify-center px-1 py-4 rounded-2xl border ${isSelected
                                            ? "bg-accent/10 border-accent/20"
                                            : "bg-white border-slate-200 shadow-sm"
                                            }`}
                                        style={{ gap: 8 }}
                                    >
                                        <View className={`p-2 rounded-xl ${isSelected ? 'bg-accent/20' : 'bg-slate-50'}`}>
                                            <Icon size={20} color={isSelected ? Colors.accent : "#94a3b8"} />
                                        </View>
                                        <Text 
                                            className={`font-bold text-[10px] text-center px-1 ${isSelected ? "text-accent" : "text-slate-500"}`} 
                                            numberOfLines={2}
                                            adjustsFontSizeToFit
                                        >
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Save Button (Floating) */}
            <View className="absolute bottom-6 left-0 right-0">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    className={`py-4 rounded-2xl shadow-xl flex-row justify-center items-center gap-2 ${saving ? "bg-gray-300" : "bg-primary"
                        }`}
                >
                    <Save size={20} color="white" />
                    <Text className="text-white text-lg font-black">{saving ? "Salvataggio..." : "Salva Modifiche"}</Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}
