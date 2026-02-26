import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { useState } from "react";
import { Heart, Globe, BookOpen, Users, Dog, Palette, ArrowLeft } from "lucide-react-native";

const INTERESTS = [
    { id: "social", label: "Sociale", icon: Users },
    { id: "environment", label: "Ambiente", icon: Globe },
    { id: "education", label: "Educazione", icon: BookOpen },
    { id: "animals", label: "Animali", icon: Dog },
    { id: "art", label: "Arte & Cultura", icon: Palette },
    { id: "health", label: "Salute", icon: Heart },
];

export default function OnboardingInterests() {
    const router = useRouter();
    const [selected, setSelected] = useState<string[]>([]);

    const toggleInterest = (label: string) => {
        if (selected.includes(label)) {
            setSelected(selected.filter((item) => item !== label));
        } else {
            setSelected([...selected, label]);
        }
    };

    const { updateUserProfile, logout } = useAuth();

    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = async () => {
        console.log("[DEBUG] Interests: handleContinue pressed");

        // DEFERRED UPDATE: We do NOT save here. We pass to next screen.
        try {
            console.log("[DEBUG] Interests: navigating to /onboarding/skills with params", selected);
            router.push({
                pathname: "/onboarding/skills",
                params: { interests: JSON.stringify(selected) }
            });
        } catch (e) {
            console.error("[DEBUG] Interests: navigation error", e);
        }
    };

    return (
        <ScreenWrapper className="px-0 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <View className="w-6" />
                    <Text className="text-lg font-bold text-primary">Onboarding - Interessi</Text>
                    {/* Hiding logout to prevent accidental exits during critical flow */}
                    <View className="w-6" />
                </View>

                {/* Progress Dots */}
                <View className="flex-row justify-center gap-2 mb-8">
                    <View className="w-8 h-2 rounded-full bg-primary" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                </View>

                <View className="px-6">
                    <Text className="text-3xl font-black text-primary mb-2">Cosa ti appassiona?</Text>
                    <Text className="text-secondary mb-8">
                        Seleziona le cause che ti stanno a cuore per ricevere suggerimenti personalizzati.
                    </Text>

                    <View className="flex-row flex-wrap gap-4 justify-center">
                        {INTERESTS.map((item) => {
                            const isSelected = selected.includes(item.label);
                            const Icon = item.icon;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => toggleInterest(item.label)}
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
