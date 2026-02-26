import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { ShieldCheck, Sparkles, Eye, FileUp, Lock, ArrowLeft } from "lucide-react-native";

const { width } = Dimensions.get("window");

import { useLocalSearchParams } from "expo-router";

// ... imports ...

export default function OnboardingVerification() {
    const router = useRouter();
    const { logout } = useAuth(); // removed updateUserProfile
    const params = useLocalSearchParams();

    // Pass these along
    const { interests, skills } = params;

    const handleNext = async () => {
        // Simulate verification pending (or skipped logic)
        // Pass isVerified = true (mock)
        router.push({
            pathname: "/onboarding/profile",
            params: {
                interests,
                skills,
                isVerified: "true"
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: "/onboarding/profile",
            params: {
                interests,
                skills,
                isVerified: "false"
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
                    <Text className="text-lg font-bold text-primary">Onboarding - Verifica</Text>
                    <TouchableOpacity onPress={() => logout()}>
                        <Text className="text-primary font-medium text-sm text-red-500">Esci</Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Dots */}
                <View className="flex-row justify-center gap-2 mb-8">
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-8 h-2 rounded-full bg-primary" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                </View>

                <View className="px-6">
                    {/* Title Section */}
                    <Text className="text-3xl font-black text-center text-primary mb-4 leading-tight">
                        Ottieni il tuo Badge di Verifica
                    </Text>
                    <Text className="text-secondary text-center leading-6 mb-8 px-2">
                        Carica un documento che attesti le tue competenze. La nostra AI analizzerà i dati per certificare il tuo profilo su AiutarSì.
                    </Text>

                    {/* Hero Visual */}
                    <View className="items-center justify-center mb-10 relative">
                        <View className="bg-primary/5 rounded-3xl w-full aspect-[4/3] items-center justify-center border border-primary/10">
                            <ShieldCheck size={80} color={Colors.primary} style={{ marginBottom: 10 }} />
                            <View className="absolute top-1/3 right-1/3 bg-accent p-2 rounded-full shadow-lg border-2 border-white">
                                <Sparkles size={20} color="white" />
                            </View>

                            <View className="flex-row gap-3 mt-4">
                                <View className="bg-primary px-3 py-1 rounded-full">
                                    <Text className="text-white text-xs font-bold uppercase tracking-wider">AI Certified</Text>
                                </View>
                                <View className="bg-pink-100 px-3 py-1 rounded-full">
                                    <Text className="text-accent text-xs font-bold uppercase tracking-wider">Trusted</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Benefit Cards */}
                    <View className="flex-row gap-4 mb-8">
                        <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
                            <Sparkles size={24} color={Colors.accent} className="mb-2" />
                            <Text className="font-bold text-primary mb-1">Analisi AI</Text>
                            <Text className="text-xs text-secondary leading-4">Certificazione immediata delle tue skill.</Text>
                        </View>
                        <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
                            <Eye size={24} color={Colors.accent} className="mb-2" />
                            <Text className="font-bold text-primary mb-1">Visibilità</Text>
                            <Text className="text-xs text-secondary leading-4">I profili verificati ricevono 3x richieste.</Text>
                        </View>
                    </View>

                    {/* Upload Area */}
                    <TouchableOpacity className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-3xl p-8 items-center justify-center mb-8 active:bg-primary/10">
                        <View className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <FileUp size={32} color={Colors.primary} />
                        </View>
                        <Text className="text-lg font-bold text-primary mb-1">Carica Documento</Text>
                        <Text className="text-secondary text-sm mb-4">PDF, JPG o PNG (Max 5MB)</Text>

                        <View className="bg-pink-100 px-3 py-1 rounded-full">
                            <Text className="text-accent text-xs font-bold uppercase">Analisi AI Sicura</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Actions */}
                    <TouchableOpacity
                        onPress={handleNext}
                        className="bg-primary py-4 rounded-xl shadow-lg items-center mb-4 active:scale-[0.98] transition-all"
                    >
                        <View className="flex-row items-center gap-2">
                            <FileUp size={20} color="white" />
                            <Text className="text-white text-lg font-bold">Inizia Analisi</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSkip} className="items-center py-2">
                        <Text className="text-secondary font-medium text-base">Salta per ora</Text>
                    </TouchableOpacity>

                    {/* GDPR Footer */}
                    <View className="flex-row justify-center items-center mt-8 opacity-60 gap-1">
                        <Lock size={12} color={Colors.secondary} />
                        <Text className="text-xs text-secondary">I tuoi dati sono criptati e gestiti secondo GDPR.</Text>
                    </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
