import { View, Text, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../components/StandardLayout";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import { Save, CheckCircle2 } from "lucide-react-native";
import { SKILLS } from "../../constants/Skills";
import { INTERESTS } from "../../constants/Interests";
import { useToast } from "../../context/ToastContext";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors } from "@/theme";

const { width } = Dimensions.get("window");

export default function VolunteerInterestsSkillsSettings() {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();
    const { showToast } = useToast();

    const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
    const [selectedSkills, setSelectedSkills] = useState<string[]>(user?.skills || []);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setSelectedInterests(user?.interests || []);
        setSelectedSkills(user?.skills || []);
    }, [user?.id, user?.interests, user?.skills]);

    const toggleInterest = (label: string) => {
        setSelectedInterests((prev) =>
            prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
        );
    };

    const toggleSkill = (label: string) => {
        setSelectedSkills((prev) =>
            prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
        );
    };

    const handleSave = async () => {
        if (selectedInterests.length === 0 || selectedSkills.length === 0) {
            showToast("error", "Seleziona almeno un interesse e una competenza.");
            return;
        }

        setSaving(true);
        try {
            console.log("[DEBUG] VolunteerInterestsSkills: saving", {
                userId: user?.id,
                interests: selectedInterests,
                skills: selectedSkills,
            });

            if (!user?.id) {
                throw new Error("Utente non disponibile.");
            }

            await updateUserProfile({
                skills: selectedSkills,
                interests: selectedInterests,
            });

            console.log("[DEBUG] VolunteerInterestsSkills: save completed");
            showToast("success", "Preferenze aggiornate!");
            router.back();
        } catch (error: any) {
            console.error("[DEBUG] VolunteerInterestsSkills: save failed", error);
            showToast("error", error?.message || "Errore durante il salvataggio.");
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                <View className="mb-10">
                    <View className="mb-6">
                        <Text className="text-2xl font-black text-primary mb-2">Le cause che ti muovono</Text>
                        <Text className="text-secondary text-base">
                            Useremo questi interessi per proporti attività e community più vicine a te.
                        </Text>
                    </View>

                    <View className="flex-row flex-wrap justify-between gap-y-3">
                        {INTERESTS.map((item, index) => {
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
                                            ? "bg-accent/10 border-accent/20"
                                            : "bg-white border-slate-200 shadow-sm"
                                            }`}
                                        style={{ aspectRatio: 1.1 }}
                                    >
                                        <Text style={{ fontSize: 32, marginBottom: 8 }}>{item.emoji}</Text>
                                        <Text
                                            className={`font-black text-sm text-center ${isSelected ? "text-accent" : "text-slate-500"}`}
                                            numberOfLines={2}
                                        >
                                            {item.label}
                                        </Text>
                                        {isSelected && (
                                            <View className="absolute top-3 right-3">
                                                <CheckCircle2 size={18} color={colors.accent} fill="white" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </View>
                </View>

                <View className="mb-8">
                    <View className="mb-6">
                        <Text className="text-2xl font-black text-primary mb-2">Competenze che vuoi offrire</Text>
                        <Text className="text-secondary text-base">
                            Le abilità che vuoi mettere in gioco quando trovi la causa giusta.
                        </Text>
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
                                            ? "bg-primary/10 border-primary/20"
                                            : "bg-white border-slate-200 shadow-sm"
                                            }`}
                                        style={{ gap: 8 }}
                                    >
                                        <View className={`p-2 rounded-xl ${isSelected ? "bg-primary/20" : "bg-slate-50"}`}>
                                            <Icon size={20} color={isSelected ? colors.primary : "#94a3b8"} />
                                        </View>
                                        <Text
                                            className={`font-bold text-[10px] text-center px-1 ${isSelected ? "text-primary" : "text-slate-500"}`}
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

            <View className="absolute bottom-6 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    className={`py-4 rounded-2xl shadow-xl flex-row justify-center items-center gap-2 ${saving ? "bg-gray-300" : "bg-primary"}`}
                >
                    <Save size={20} color="white" />
                    <Text className="text-white text-lg font-black">{saving ? "Salvataggio..." : "Salva Modifiche"}</Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}
