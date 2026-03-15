import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter , useLocalSearchParams } from "expo-router";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { useState } from "react";
import { ArrowLeft, Code, MessageSquare, Heart, Lightbulb, PenTool, BarChart, HardHat, Camera } from "lucide-react-native";



import { SKILLS } from "../../constants/Skills";

// ... existing imports ...

export default function OnboardingSkills() {
    const router = useRouter();
    const { user, logout } = useAuth(); // removed updateUserProfile
    const params = useLocalSearchParams();
    const interestsJson = params.interests as string || "[]";

    // We don't initialize from user.skills anymore if we want to be pure, 
    // but for editing existing user it's fine. 
    // For deferred flow, we assume we start fresh or from what we have.
    const [selected, setSelected] = useState<string[]>(user?.skills || []);

    const toggleSkill = (label: string) => {
        if (selected.includes(label)) {
            setSelected(selected.filter((item) => item !== label));
        } else {
            setSelected([...selected, label]);
        }
    };

    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = async () => {
        // DEFERRED UPDATE: Pass everything to next screen
        router.push({
            pathname: "/onboarding/profile",
            params: {
                interests: interestsJson,
                skills: JSON.stringify(selected)
            }
        });
    };

    return (
        <ScreenWrapper className="px-0 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft size={24} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-primary">Competenze</Text>
                    <TouchableOpacity onPress={() => logout()}>
                        <Text className="text-primary font-medium text-sm text-red-500">Esci</Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Dots */}
                <View className="flex-row justify-center gap-2 mb-8">
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-8 h-2 rounded-full bg-primary" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                </View>

                <View className="px-6">
                    <Text className="text-3xl font-black text-primary mb-2">Cosa sai fare?</Text>
                    <Text className="text-secondary mb-8">
                        Seleziona le tue competenze principali per aiutarci a trovare le attività giuste per te.
                    </Text>

                    <View className="flex-row flex-wrap gap-4 justify-center">
                        {SKILLS.map((item) => {
                            const isSelected = selected.includes(item.label);
                            const Icon = item.icon;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => toggleSkill(item.label)}
                                    className={`w-[45%] aspect-square rounded-2xl p-4 justify-between border-2 ${isSelected ? "bg-primary/5 border-primary" : "bg-white border-primary/5 shadow-sm"
                                        }`}
                                >
                                    <Icon size={32} color={isSelected ? Colors.primary : Colors.secondary} />
                                    <View>
                                        <Text className={`font-bold text-lg ${isSelected ? "text-primary" : "text-secondary"}`}>
                                            {item.label}
                                        </Text>
                                        {isSelected && <Text className="text-xs text-primary">Selezionato</Text>}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            <View className="p-6 border-t border-primary/5 bg-background-light">
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={selected.length === 0 || isLoading}
                    className={`py-4 rounded-xl shadow-lg items-center ${selected.length > 0 ? "bg-accent" : "bg-gray-300"
                        }`}
                >
                    <Text className="text-white text-lg font-bold">
                        {isLoading ? "Salvataggio..." : "Continua"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
}
