import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Award, Settings, Camera, Mail } from "lucide-react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { AppUser } from "../../types";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { saveImageToPermanentStorage } from "../../utils/FileStorage";

interface ProfileHeaderProps {
    user: AppUser | null;
    level: number;
    isOwnProfile: boolean;
    onSettingsPress?: () => void;
}

export function ProfileHeader({ user, level, isOwnProfile, onSettingsPress }: ProfileHeaderProps) {
    const { updateUserProfile } = useAuth();

    const pickImage = async () => {
        if (!isOwnProfile) return;

        // Request permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
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
                        name={user?.full_name || undefined}
                        avatarUrl={user?.avatar_url || undefined}
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
                    isOwnProfile && (
                        <TouchableOpacity
                            onPress={onSettingsPress}
                            className="bg-primary/5 px-6 py-3 rounded-full mb-4 border border-primary/10 flex-row items-center justify-center gap-2 self-center"
                            activeOpacity={0.7}
                        >
                            <Settings size={18} color={Colors.primary} />
                            <Text className="text-primary font-bold text-sm">Completa il tuo profilo</Text>
                        </TouchableOpacity>
                    )
                )}
            </View>

            {/* Location & Email Display */}
            <View className="items-center mb-2 px-4">
                {user?.location_string && (
                    <Text className="text-xs text-gray-500 font-medium mb-1">📍 {user.location_string}</Text>
                )}
                {(isOwnProfile || user?.show_email) && user?.email && (
                    <View className="flex-row items-center gap-1">
                        <Mail size={12} color="#94a3b8" />
                        <Text className="text-xs text-gray-400 font-medium">{user.email}</Text>
                    </View>
                )}
            </View>
        </View>
    );
}
