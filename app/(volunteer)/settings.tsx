import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { Settings, LogOut, Bell, ChevronRight, Shield, HelpCircle, Pencil, Heart, Check } from "lucide-react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { StandardLayout } from "../../components/StandardLayout";

import { useActivities } from "../../context/ActivityContext";
import { useApplications } from "../../context/ApplicationContext";
import { useToast } from "../../context/ToastContext";

export default function VolunteerSettings() {
    const { user, logout, updateUserProfile, resetUsers, isLoading: isAuthLoading } = useAuth();
    const { showToast } = useToast();
    const { resetData } = useActivities();
    const { resetApplications } = useApplications();
    const router = useRouter();

    // Split name into Nome and Cognome if possible, else defaults
    const nameParts = user?.name?.split(" ") || ["", ""];
    const [firstName, setFirstName] = useState(nameParts[0]);
    const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
    const [bio, setBio] = useState(user?.bio || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [avatar, setAvatar] = useState<string | null>(null);
    const [locationInput, setLocationInput] = useState(user?.locationString || "Rilevamento in corso...");
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
            // Auto-save avatar when picked if not already in global editing mode
            if (!isEditing) {
                setIsAvatarUploading(true);
                try {
                    await updateUserProfile({ avatar: result.assets[0].uri });
                    showToast('success', 'Foto profilo aggiornata!');
                } catch (error: any) {
                    alert("Errore upload avatar: " + error.message);
                } finally {
                    setIsAvatarUploading(false);
                }
            }
        }
    };

    // Sync state with user data when it loads/updates
    useEffect(() => {
        if (user) {
            const parts = user.name?.split(" ") || ["", ""];
            setFirstName(parts[0]);
            setLastName(parts.slice(1).join(" "));
            setBio(user.bio || "");
            setPhone(user.phone || "");
            if (user.locationString) setLocationInput(user.locationString);
        }
    }, [user]);

    // Automatic location fetching
    useEffect(() => {
        (async () => {
            // Force refresh of location on mount as per user request
            // if (user?.locationString && user?.locationCoords) {
            //    setLocationInput(user.locationString);
            //    return;
            // }

            setLocationInput("Rilevamento in corso...");

            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationInput("Posizione non consentita");
                    return;
                }

                let location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;

                // Reverse geocode
                let address = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (address && address.length > 0) {
                    const city = address[0].city || address[0].region || "Sconosciuta";
                    const formattedLocation = `Posizione attuale - ${city}`;

                    setLocationInput(formattedLocation);

                    // Update user profile automatically
                    updateUserProfile({
                        locationCoords: { lat: latitude, lng: longitude },
                        locationString: formattedLocation
                    });
                }
            } catch (error) {
                console.error("Error fetching location", error);
                setLocationInput("Errore rilevamento posizione");
            }
        })();
    }, []);

    const [isEditing, setIsEditing] = useState(false);

    const toggleEditMode = async () => {
        if (isEditing) {
            // Save logic
            try {
                // Only include avatar in payload if user actually picked a new image
                // Omitting the key entirely prevents overwriting the existing avatar_url
                const profileUpdates: Partial<any> = {
                    name: `${firstName} ${lastName}`,
                    bio,
                    phone,
                };
                if (avatar) {
                    profileUpdates.avatar = avatar;
                }

                await updateUserProfile(profileUpdates);
                setIsEditing(false);
                setAvatar(null); // Reset local new-image state after sync
                showToast('success', 'Profilo salvato correttamente');
            } catch (error: any) {
                alert("Errore salvataggio profilo: " + error.message);
            }
        } else {
            setIsEditing(true);
        }
    };

    const HeaderActions = (
        <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={toggleEditMode}>
                {isEditing ? (
                    <View className="bg-white/20 p-2 rounded-full">
                        <Check size={24} color="white" />
                    </View>
                ) : (
                    <Pencil size={24} color="white" />
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <StandardLayout
            label="Il tuo Account"
            title="Impostazioni"
            rightElement={HeaderActions}
            bg="bg-background-light"
            onBack={() => router.back()}
        >
            {/* Personal Info Section */}
            <View className="py-2">
                <View className="flex-row justify-between items-end mb-6">
                    <Text className="text-lg font-black text-primary">Informazioni Personali</Text>

                    {/* Avatar Picker */}
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={isAvatarUploading}
                        className="items-center"
                    >
                        <View className="relative">
                            <View className="w-20 h-20 rounded-full border-2 border-primary/20 overflow-hidden bg-gray-100">
                                {avatar || user?.avatar ? (
                                    <Image
                                        source={{ uri: avatar || user?.avatar }}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <View className="w-full h-full items-center justify-center">
                                        <Text className="text-primary/40 text-2xl font-bold">
                                            {firstName?.charAt(0)}{lastName?.charAt(0)}
                                        </Text>
                                    </View>
                                )}
                                {isAvatarUploading && (
                                    <View className="absolute inset-0 bg-black/30 items-center justify-center">
                                        <ActivityIndicator color="white" />
                                    </View>
                                )}
                            </View>
                            <View className="absolute bottom-0 right-0 bg-primary p-1.5 rounded-full border-2 border-white">
                                <Pencil size={12} color="white" />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                <View className="gap-6">
                    <View>
                        <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Nome</Text>
                        <View className={`p-4 rounded-2xl shadow-sm border ${isEditing ? "bg-white border-accent" : "bg-gray-50 border-gray-100"}`}>
                            <TextInput
                                value={firstName}
                                onChangeText={setFirstName}
                                editable={isEditing}
                                className={`text-primary font-medium text-lg ${!isEditing && "opacity-60"}`}
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Cognome</Text>
                        <View className={`p-4 rounded-2xl shadow-sm border ${isEditing ? "bg-white border-accent" : "bg-gray-50 border-gray-100"}`}>
                            <TextInput
                                value={lastName}
                                onChangeText={setLastName}
                                editable={isEditing}
                                className={`text-base text-primary font-medium ${isEditing ? "p-0" : ""}`}
                            />
                        </View>
                    </View>

                    {/* Bio Field */}
                    <View>
                        <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Bio</Text>
                        <View className={`p-4 rounded-2xl shadow-sm border ${isEditing ? "bg-white border-accent" : "bg-gray-50 border-gray-100"}`}>
                            <TextInput
                                value={bio}
                                onChangeText={setBio}
                                editable={isEditing}
                                multiline
                                numberOfLines={3}
                                placeholder="Raccontaci qualcosa di te..."
                                placeholderTextColor="#9ca3af"
                                className={`text-base text-primary font-medium ${isEditing ? "p-0" : ""} ${!isEditing && !bio ? "text-gray-400 italic" : ""}`}
                                verticalAlign="top"
                            />
                            {!isEditing && !bio && <Text className="text-gray-400 italic absolute top-4 left-4">Nessuna bio inserita</Text>}
                        </View>
                    </View>

                    {/* Contact Info */}
                    <View>
                        <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Telefono</Text>
                        <View className={`p-4 rounded-2xl shadow-sm border ${isEditing ? "bg-white border-accent" : "bg-gray-50 border-gray-100"}`}>
                            <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                editable={isEditing}
                                keyboardType="phone-pad"
                                placeholder="+39..."
                                placeholderTextColor="#9ca3af"
                                className={`text-base text-primary font-medium ${isEditing ? "p-0" : ""} ${!isEditing && !phone ? "text-gray-400 italic" : ""}`}
                            />
                            {!isEditing && !phone && <Text className="text-gray-400 italic absolute top-4 left-4">--</Text>}
                        </View>
                    </View>

                    <View>
                        <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Località</Text>
                        <View className="bg-gray-100 p-4 rounded-2xl shadow-sm border border-gray-50">
                            <TextInput
                                value={locationInput}
                                editable={false}
                                className="text-secondary font-medium text-lg italic"
                            />
                        </View>
                    </View>
                </View>

                {isEditing && (
                    <TouchableOpacity
                        onPress={toggleEditMode}
                        className="bg-accent mt-6 py-4 rounded-2xl items-center shadow-lg shadow-accent/20"
                    >
                        <Text className="text-white font-bold text-lg">Salva Modifiche</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Account Section */}
            <View className="py-8">
                <Text className="text-lg font-black text-primary mb-4">Account</Text>

                <View className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-50">
                    {/* Privacy */}
                    <TouchableOpacity className="p-5 flex-row items-center justify-between border-b border-gray-50">
                        <View className="flex-row items-center gap-4">
                            <Shield size={20} color={Colors.primary} />
                            <Text className="text-primary font-bold text-lg">Privacy e Sicurezza</Text>
                        </View>
                        <ChevronRight size={20} color={Colors.secondary} />
                    </TouchableOpacity>

                    {/* Interests & Skills */}
                    <TouchableOpacity onPress={() => router.push("/(volunteer)/interests-skills" as any)} className="p-5 flex-row items-center justify-between border-b border-gray-50">
                        <View className="flex-row items-center gap-4">
                            <Heart size={20} color={Colors.primary} />
                            <Text className="text-primary font-bold text-lg">Interessi e Competenze</Text>
                        </View>
                        <ChevronRight size={20} color={Colors.secondary} />
                    </TouchableOpacity>

                    {/* Notifications */}
                    <TouchableOpacity onPress={() => router.push("/(volunteer)/notifications")} className="p-5 flex-row items-center justify-between border-b border-gray-50">
                        <View className="flex-row items-center gap-4">
                            <Bell size={20} color={Colors.primary} />
                            <Text className="text-primary font-bold text-lg">Notifiche</Text>
                        </View>
                        <ChevronRight size={20} color={Colors.secondary} />
                    </TouchableOpacity>

                    {/* Help */}
                    <TouchableOpacity className="p-5 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-4">
                            <HelpCircle size={20} color={Colors.primary} />
                            <Text className="text-primary font-bold text-lg">Centro Assistenza</Text>
                        </View>
                        <ChevronRight size={20} color={Colors.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="mt-4 pb-12">
                <TouchableOpacity
                    onPress={async () => {
                        await logout();
                    }}
                    disabled={isAuthLoading}
                    className="bg-[#fff1f2] border border-[#ffe4e6] p-5 rounded-2xl flex-row justify-center items-center gap-3 active:opacity-70"
                >
                    {isAuthLoading ? (
                        <ActivityIndicator color="#e11d48" />
                    ) : (
                        <View className="flex-row items-center gap-3">
                            <LogOut size={24} color="#e11d48" />
                            <Text className="text-[#e11d48] font-black text-lg">Log Out</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Debug Reset Button */}
                <TouchableOpacity
                    onPress={async () => {
                        await resetData();
                        await resetUsers();
                        await resetApplications();
                        alert("Dati Utenti, Attività e Candidature resettati con successo!");
                    }}
                    className="mt-4 bg-gray-100 border border-gray-200 p-4 rounded-2xl flex-row justify-center items-center gap-3 active:opacity-70"
                >
                    <Text className="text-gray-500 font-bold text-sm">Resetta Dati App (Debug)</Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}
