import React from "react";
import { Alert, View, Text, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Award, Camera, Mail, Sparkles, ChevronRight } from "lucide-react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { AppUser } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { saveImageToPermanentStorage } from "../../utils/FileStorage";
import { requestMediaLibraryPermission } from "../../utils/permissions";
import { colors } from "@/theme";

interface ProfileHeaderProps {
    user: AppUser | null;
    level: number;
    isOwnProfile: boolean;
    onSettingsPress?: () => void;
}

export function ProfileHeader({ user, level, isOwnProfile, onSettingsPress }: ProfileHeaderProps) {
    const { updateUserProfile, resendSignupConfirmation } = useAuth();
    const [isResendingConfirmation, setIsResendingConfirmation] = React.useState(false);
    const shouldShowProfilePrompt =
        !!isOwnProfile &&
        (!user?.profile_completed || !user?.bio || !user?.avatar_url);

    const pickImage = async () => {
        if (!isOwnProfile) return;

        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per aggiornare la tua foto profilo.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            alert('Scusa, abbiamo bisogno dei permessi della galleria per farlo funzionare!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const permanentUri = await saveImageToPermanentStorage(result.assets[0].uri);
            await updateUserProfile({ avatar_url: permanentUri });
        }
    };

    const handleResendConfirmation = async () => {
        if (!user?.email || isResendingConfirmation) return;
        try {
            setIsResendingConfirmation(true);
            await resendSignupConfirmation(user.email);
            Alert.alert("Email inviata", "Ti abbiamo inviato una nuova mail di conferma.");
        } catch (error: any) {
            Alert.alert("Invio non riuscito", error?.message || "Non siamo riusciti a reinviare la mail di conferma.");
        } finally {
            setIsResendingConfirmation(false);
        }
    };

    return (
        <View className="items-center mb-2 mt-4">
            <TouchableOpacity
                disabled={!isOwnProfile}
                onPress={pickImage}
                activeOpacity={0.8}
                className="relative mb-3"
            >
                <View className="p-1 rounded-full border-4 border-accent shadow-lg bg-white">
                    <UserAvatar
                        size={90}
                        fontSize={32}
                        name={user?.full_name || user?.name || undefined}
                        avatarUrl={user?.avatar_url || user?.avatar || undefined}
                        role={user?.role}
                        verificationStatus={user?.verification_status}
                        isVerified={!!user?.is_verified}
                    />
                </View>

                {isOwnProfile && (
                    <View className="absolute top-0 right-0 bg-primary p-2 rounded-full border-2 border-white shadow-sm">
                        <Camera size={14} color="white" />
                    </View>
                )}

                <View className="absolute -bottom-2 -right-2 bg-accent px-3 py-1 rounded-full border-2 border-white shadow-sm flex-row items-center gap-1">
                    <Award size={12} color="white" />
                    <Text className="text-white font-bold text-xs">Lv. {level}</Text>
                </View>
            </TouchableOpacity>
            <Text className="text-2xl font-black text-primary mb-1 text-center">{user?.full_name || "Utente"}</Text>


            {/* Bio & Contacts */}
            <View className="w-full px-4 mb-2">
                {user?.bio ? (
                    <Text className="text-center text-secondary text-sm leading-5 px-4 mb-2">
                        {user.bio}
                    </Text>
                ) : (
                    <View className="mb-2" />
                )}

                {shouldShowProfilePrompt && (
                    <TouchableOpacity
                        onPress={onSettingsPress}
                        className="bg-primary/5 px-4 py-3 rounded-2xl mb-4 border border-primary/10 self-center min-w-[260px]"
                        activeOpacity={0.8}
                    >
                        <View className="flex-row items-center">
                            <View className="w-9 h-9 rounded-2xl bg-primary/10 items-center justify-center mr-3">
                                <Sparkles size={16} color={colors.primary} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-primary font-bold text-sm">Completa il tuo profilo</Text>
                                <Text className="text-secondary text-xs mt-0.5">
                                    Aggiungi foto e bio per presentarti meglio agli enti.
                                </Text>
                            </View>
                            <ChevronRight size={16} color={colors.primary} />
                        </View>
                    </TouchableOpacity>
                )}
            </View>

            {/* Location & Email Display */}
            <View className="items-center mb-2 px-4">
                {user?.location_string && (
                    <Text className="text-xs text-gray-500 font-medium mb-1">📍 {user.location_string}</Text>
                )}
                {isOwnProfile && user?.email && (
                    <View className="items-center">
                        <View className="flex-row items-center gap-1">
                            <Mail size={12} color="#94a3b8" />
                            <Text className="text-xs text-gray-400 font-medium">{user.email}</Text>
                        </View>
                        {user.email_confirmed === false && (
                            <View className="flex-row items-center mt-1">
                                <Text className="text-[11px] text-orange-600 font-medium">
                                    Ricordati di confermare la mail!
                                </Text>
                                <TouchableOpacity onPress={handleResendConfirmation} activeOpacity={0.8} disabled={isResendingConfirmation}>
                                    <Text className="text-[11px] text-primary font-bold ml-1">
                                        {isResendingConfirmation ? 'Invio...' : 'Reinvia.'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}
