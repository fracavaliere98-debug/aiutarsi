import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Colors } from "../../constants/Colors";
import { useState } from "react";
import { Camera, ArrowLeft, Loader2 } from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';

import { useLocalSearchParams } from "expo-router";

// ... imports

export default function OnboardingProfile() {
    const router = useRouter();
    const { updateUserProfile, logout } = useAuth();
    const { showToast } = useToast();
    const [bio, setBio] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    // Retrieve all accumulated data
    const params = useLocalSearchParams();

    const finishOnboarding = async () => {
        console.log("[DEBUG] Onboarding Profile: Finishing...", params);

        const interests = params.interests ? JSON.parse(params.interests as string) : [];
        const skills = params.skills ? JSON.parse(params.skills as string) : [];
        const isVerified = params.isVerified === "true";

        // FINAL SAVE
        // FINAL SAVE
        setIsUploading(true);
        try {
            const success = await updateUserProfile({
                interests,
                skills,
                isVerified,
                bio,
                avatar: avatar || undefined,
                profileCompleted: true
            });

            if (success) {
                console.log("[DEBUG] Onboarding Profile: SAVE SUCCESS. Router should redirect.");
                showToast('success', 'Benvenuto! Profilo creato.');
                router.replace("/(volunteer)/(tabs)" as any);
            }
        } catch (error: any) {
            console.error("[DEBUG] Onboarding Profile: SAVE FAILED", error);
            alert("Errore salvataggio profilo: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <ScreenWrapper className="px-0 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="px-6 pt-2 pb-3 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft size={24} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text className="text-base font-bold text-primary">Onboarding - Profilo</Text>
                    <TouchableOpacity onPress={() => logout()}>
                        <Text className="text-primary font-medium text-sm text-red-500">Esci</Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Dots */}
                <View className="flex-row justify-center gap-2 mb-6">
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-2 h-2 rounded-full bg-primary/20" />
                    <View className="w-8 h-2 rounded-full bg-primary" />
                </View>

                <View className="px-6">
                    <Text className="text-3xl font-black text-primary mb-2">Completa il Profilo</Text>
                    <Text className="text-secondary mb-6">
                        Aggiungi una foto e una breve bio per farti conoscere dalle associazioni.
                    </Text>

                    <View className="items-center mb-8">
                        <TouchableOpacity
                            onPress={pickImage}
                            disabled={isUploading}
                            className="w-32 h-32 bg-white rounded-full items-center justify-center border-2 border-dashed border-primary/30 relative shadow-sm overflow-hidden"
                        >
                            {avatar ? (
                                <Image source={{ uri: avatar }} className="w-full h-full" />
                            ) : (
                                <Camera size={40} color={Colors.primary} opacity={0.5} />
                            )}
                            <View className="absolute bottom-0 right-0 bg-accent p-2 rounded-full">
                                {isUploading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white text-xs font-bold">+</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                        <Text className="text-sm text-primary/60 mt-2 font-medium">Carica foto profilo</Text>
                    </View>

                    <View className="gap-4 mb-10">
                        <View>
                            <Text className="text-sm font-bold text-primary mb-2 ml-1">Bio</Text>
                            <TextInput
                                className="bg-white p-4 rounded-xl border border-primary/10 text-primary h-32 shadow-sm"
                                placeholder="Raccontaci qualcosa di te, le tue esperienze o perché vuoi fare volontariato..."
                                placeholderTextColor="#9ca3af"
                                multiline
                                textAlignVertical="top"
                                value={bio}
                                onChangeText={setBio}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={finishOnboarding}
                        disabled={isUploading}
                        className={`bg-primary py-4 rounded-xl shadow-lg items-center ${isUploading ? 'opacity-70' : ''}`}
                    >
                        {isUploading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-lg font-bold">Inizia l'avventura</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={finishOnboarding} className="mt-4 items-center py-2">
                        <Text className="text-secondary font-medium text-base">Salta per ora</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
