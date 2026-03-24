import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import * as ImagePicker from 'expo-image-picker';

import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { Settings, LogOut, Bell, ChevronRight, Shield, HelpCircle, Pencil, Heart, Check, Trash2, Camera, User, FileText, Database, ShieldBan, Users, Mail, Lock } from 'lucide-react-native';
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import Constants from 'expo-constants';
import { StandardLayout } from "../../components/StandardLayout";
import { SoftCard } from "../../components/SoftCard";
import { UserAvatar } from "../../components/UserAvatar";

import { useActivities } from "../../context/ActivityContext";
import { useApplications } from "../../context/ApplicationContext";
import { useToast } from "../../context/ToastContext";

export default function VolunteerSettings() {
    const { user, logout, updateUserProfile, resetUsers, isLoading: isAuthLoading, requestAccountDeletion, updateEmail, updatePassword } = useAuth();
    const { showToast } = useToast();
    const { resetData } = useActivities();
    const { resetApplications } = useApplications();
    const router = useRouter();

    const appVersion = Constants.expoConfig?.version || "1.0.0";

    // Modals
    const [showEditProfile, setShowEditProfile] = useState(false);

    // Profile state
    const nameParts = user?.name?.split(" ") || ["", ""];
    const [firstName, setFirstName] = useState(nameParts[0]);
    const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
    const [bio, setBio] = useState(user?.bio || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [avatar, setAvatar] = useState<string | null>(null);
    const [locationInput, setLocationInput] = useState(user?.locationString || "Rilevamento in corso...");
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Change Email/Password states
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [isUpdatingAuth, setIsUpdatingAuth] = useState(false);

    const handleEmailUpdate = async () => {
        if (!newEmail || !newEmail.includes("@")) {
            Alert.alert("Errore", "Inserisci un indirizzo email valido.");
            return;
        }

        setIsUpdatingAuth(true);
        try {
            await updateEmail(newEmail);
            showToast('success', 'Email aggiornata! Controlla la posta per la conferma.');
            setShowChangeEmail(false);
            setNewEmail("");
        } catch (error: any) {
            Alert.alert("Errore", error.message);
        } finally {
            setIsUpdatingAuth(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!currentPassword || !newPassword) {
            Alert.alert("Errore", "Compila tutti i campi.");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            Alert.alert("Errore", "Le password non coincidono.");
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert("Errore", "La nuova password deve essere di almeno 6 caratteri.");
            return;
        }

        setIsUpdatingAuth(true);
        try {
            await updatePassword(currentPassword, newPassword);
            showToast('success', 'Password aggiornata con successo!');
            setShowChangePassword(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
        } catch (error: any) {
            Alert.alert("Errore", error.message);
        } finally {
            setIsUpdatingAuth(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Scusa, abbiamo bisogno dei permessi della galleria per farlo funzionare!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
            if (!showEditProfile) {
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
        let isMounted = true;
        
        const fetchLocation = async () => {
            // Avoid redundant fetching if we already have it in this session 
            // or if it's already "Posizione attuale"
            if (user?.locationString?.includes("Posizione attuale")) {
                setLocationInput(user.locationString);
                return;
            }

            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (isMounted) setLocationInput("Posizione non consentita");
                    return;
                }

                if (isMounted) setLocationInput("Rilevamento in corso...");
                
                let location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                
                const { latitude, longitude } = location.coords;

                // Reverse geocode with error handling
                try {
                    let address = await Location.reverseGeocodeAsync({ latitude, longitude });
                    if (address && address.length > 0 && isMounted) {
                        const city = address[0].city || address[0].region || "Sconosciuta";
                        const formattedLocation = `Posizione attuale - ${city}`;

                        setLocationInput(formattedLocation);

                        // Update user profile automatically - only if different
                        if (user?.locationString !== formattedLocation) {
                            updateUserProfile({
                                location_lat: latitude,
                                location_lng: longitude,
                                locationString: formattedLocation
                            });
                        }
                    }
                } catch (geoError: any) {
                    console.warn("Geocoding failed:", geoError.message);
                    if (isMounted) setLocationInput("Località non disponibile");
                }
            } catch (error: any) {
                console.error("Error fetching location", error);
                if (isMounted) setLocationInput("Errore rilevamento");
            }
        };

        fetchLocation();
        
        return () => { isMounted = false; };
    }, []); // Only run once on mount

    const saveProfile = async () => {
        setIsSaving(true);
        try {
            const profileUpdates: Partial<any> = {
                name: `${firstName} ${lastName}`,
                bio,
                phone,
            };
            if (avatar) {
                profileUpdates.avatar_url = avatar;
            }

            await updateUserProfile(profileUpdates);
            setShowEditProfile(false);
            setAvatar(null);
            showToast('success', 'Profilo salvato correttamente');
        } catch (error: any) {
            alert("Errore salvataggio profilo: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const SectionHeader = ({ title }: { title: string }) => (
        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">
            {title}
        </Text>
    );

    const MenuItem = ({
        icon: Icon,
        label,
        color,
        onPress,
        last = false
    }: {
        icon: any,
        label: string,
        color: string,
        onPress?: () => void,
        last?: boolean
    }) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`flex-row items-center justify-between py-4 ${!last ? 'border-b border-gray-50' : ''}`}
        >
            <View className="flex-row items-center gap-4">
                <View style={{ backgroundColor: color + '15' }} className="p-2.5 rounded-2xl">
                    <Icon size={20} color={color} />
                </View>
                <Text className="text-primary font-bold text-base">{label}</Text>
            </View>
            <View className="flex-row items-center gap-2">
                <ChevronRight size={18} color="#cbd5e1" />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <StandardLayout
                label="Il tuo Account"
                title="Impostazioni"
                onBack={() => router.back()}
            >
                {/* Profile Card */}
                <SoftCard className="mb-8 items-center p-6 mt-2">
                    <TouchableOpacity
                        onPress={pickImage}
                        activeOpacity={0.8}
                        className="relative"
                    >
                        {avatar || user?.avatar ? (
                            <View className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/10">
                                <Image
                                    source={{ uri: avatar || user?.avatar }}
                                    className="w-full h-full"
                                />
                            </View>
                        ) : (
                            <UserAvatar size={100} fontSize={32} useAuthFallback={true} />
                        )}
                        {!avatar && !user?.avatar && (
                            <View
                                className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-4 border-white"
                                style={{ backgroundColor: Colors.primary }}
                            >
                                <Camera size={16} color="white" />
                            </View>
                        )}
                        {isAvatarUploading && (
                            <View className="absolute inset-0 bg-black/30 w-24 h-24 rounded-full items-center justify-center">
                                <ActivityIndicator color="white" />
                            </View>
                        )}
                    </TouchableOpacity>

                    <Text className="text-primary font-black text-2xl mt-4 text-center">
                        {user?.name || "Utente"}
                    </Text>
                    <Text className="text-secondary font-bold text-sm mt-1">
                        ID: #{user?.shortId || user?.id?.substring(0, 8).toUpperCase() || "N/A"}
                    </Text>

                    <TouchableOpacity
                        className="mt-6 px-8 py-3 rounded-2xl"
                        activeOpacity={0.7}
                        style={{ backgroundColor: Colors.primary + '10' }}
                        onPress={() => setShowEditProfile(true)}
                    >
                        <Text className="font-black text-sm" style={{ color: Colors.primary }}>
                            Modifica Profilo Personale
                        </Text>
                    </TouchableOpacity>
                </SoftCard>

                <SectionHeader title="Account" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={User}
                        label="Dati Personali"
                        color={Colors.primary}
                        onPress={() => setShowEditProfile(true)}
                    />
                    <MenuItem
                        icon={Heart}
                        label="Interessi e Competenze"
                        color="#ec4899"
                        onPress={() => router.push("/(volunteer)/interests-skills" as any)}
                    />
                    <MenuItem
                        icon={ShieldBan}
                        label="Account bloccati"
                        color={Colors.accent}
                        onPress={() => router.push("/blocked-users" as any)}
                    />
                    <MenuItem
                        icon={Users}
                        label="Porta un amico"
                        color={Colors.primary}
                        onPress={() => router.push("/(volunteer)/referral" as any)}
                        last
                    />
                </SoftCard>

                {user && (user.role as string) === 'ADMIN' && (
                    <>
                        <SectionHeader title="Amministrazione" />
                        <SoftCard className="mb-8 px-5">
                            <MenuItem
                                icon={ShieldBan}
                                label="Area Admin"
                                color="#8B5CF6"
                                onPress={() => router.push("/admin" as any)}
                                last
                            />
                        </SoftCard>
                    </>
                )}

                <SectionHeader title="Sicurezza" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={Mail}
                        label="Cambia Email"
                        color="#3b82f6"
                        onPress={() => setShowChangeEmail(true)}
                    />
                    <MenuItem
                        icon={Lock}
                        label="Cambia Password"
                        color={Colors.accent}
                        onPress={() => setShowChangePassword(true)}
                        last
                    />
                </SoftCard>

                <SectionHeader title="Dati & Privacy" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={Shield}
                        label="Privacy e Visibilità"
                        color={Colors.success}
                        onPress={() => router.push("/(volunteer)/privacy" as any)}
                    />
                    <MenuItem
                        icon={HelpCircle}
                        label="Centro Assistenza"
                        color="#ef4444"
                        onPress={() => router.push('/help-center' as any)}
                    />
                    <MenuItem
                        icon={FileText}
                        label="Termini e Condizioni"
                        color={Colors.primary}
                        onPress={() => router.push("/(corporate)/terms")}
                        last
                    />
                </SoftCard>

                {/* Reset Buttons for Testing */}
                <SectionHeader title="Opzioni Sviluppatore" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={Database}
                        label="Resetta Dati App (Debug)"
                        color={Colors.secondary}
                        onPress={async () => {
                            await resetData();
                            await resetUsers();
                            await resetApplications();
                            alert("Dati Utenti, Attività e OldCandidature resettati con successo!");
                        }}
                        last
                    />
                </SoftCard>

                {/* Log Out - styled like other menu items */}
                <SoftCard className="mb-8 px-5">
                    <TouchableOpacity
                        onPress={async () => await logout()}
                        disabled={isAuthLoading}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between py-4"
                    >
                        <View className="flex-row items-center gap-4">
                            <View className="bg-red-50 p-2.5 rounded-2xl">
                                {isAuthLoading ? (
                                    <ActivityIndicator size={20} color="#ef4444" />
                                ) : (
                                    <LogOut size={20} color="#ef4444" />
                                )}
                            </View>
                            <Text className="text-red-500 font-bold text-base">Esci dall&apos;Account</Text>
                        </View>
                        <ChevronRight size={18} color="#fca5a5" />
                    </TouchableOpacity>
                </SoftCard>

                {/* Info and Versioning */}
                <TouchableOpacity
                    className="mb-8 items-center"
                    onPress={() => {
                        Alert.alert(
                            "Elimina Account",
                            "Sei sicuro di voler eliminare il tuo account? Avrai 30 giorni per cambiare idea e annullare la richiesta dal tuo profilo.",
                            [
                                { text: "Annulla", style: "cancel" },
                                {
                                    text: "Elimina",
                                    style: "destructive",
                                    onPress: async () => {
                                        try {
                                            await requestAccountDeletion();
                                            showToast('success', 'Richiesta di eliminazione inviata correttamente.');
                                            router.back();
                                        } catch (error: any) {
                                            Alert.alert("Errore", error.message);
                                        }
                                    }
                                }
                            ]
                        );
                    }}
                >
                    <Text className="text-red-400 font-bold">Elimina Account</Text>
                </TouchableOpacity>

                <View className="mb-10 items-center">
                    <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">
                        AiutarSi v{appVersion}
                    </Text>
                </View>
            </StandardLayout>

            {/* Edit Profile Modal */}
            <Modal
                animationType="slide"
                visible={showEditProfile}
                onRequestClose={() => setShowEditProfile(false)}
                statusBarTranslucent={true}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                    <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                        <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                            <Text className="text-secondary font-bold text-base">Annulla</Text>
                        </TouchableOpacity>
                        <Text className="text-primary font-black text-lg">Modifica Profilo</Text>
                        <TouchableOpacity onPress={saveProfile} disabled={isSaving}>
                            {isSaving ? (
                                <ActivityIndicator color={Colors.primary} size="small" />
                            ) : (
                                <Text className="font-bold text-base" style={{ color: Colors.primary }}>Salva</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    <ScrollView className="flex-1 p-6">
                        <View className="gap-6 pb-12">
                            <View>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Nome</Text>
                                <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                    <TextInput
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        className="text-primary font-medium text-lg p-0"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Cognome</Text>
                                <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                    <TextInput
                                        value={lastName}
                                        onChangeText={setLastName}
                                        className="text-base text-primary font-medium p-0"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Bio</Text>
                                <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                    <TextInput
                                        value={bio}
                                        onChangeText={setBio}
                                        multiline
                                        numberOfLines={3}
                                        placeholder="Raccontaci qualcosa di te..."
                                        placeholderTextColor="#9ca3af"
                                        className="text-base text-primary font-medium p-0"
                                        verticalAlign="top"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Telefono</Text>
                                <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                    <TextInput
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                        placeholder="+39..."
                                        placeholderTextColor="#9ca3af"
                                        className="text-base text-primary font-medium p-0"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Località</Text>
                                <View className="bg-gray-100 p-4 rounded-2xl shadow-sm border border-gray-50">
                                    <TextInput
                                        value={locationInput}
                                        editable={false}
                                        className="text-secondary font-medium text-lg italic p-0"
                                    />
                                </View>
                                <Text className="text-secondary/60 text-xs mt-2 ml-1">La località viene aggiornata automaticamente.</Text>
                            </View>
                        </View>
                    </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
            
            {/* Change Email Modal */}
            <Modal
                animationType="slide"
                visible={showChangeEmail}
                onRequestClose={() => setShowChangeEmail(false)}
                statusBarTranslucent={true}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                            <TouchableOpacity onPress={() => setShowChangeEmail(false)}>
                                <Text className="text-secondary font-bold text-base">Annulla</Text>
                            </TouchableOpacity>
                            <Text className="text-primary font-black text-lg">Cambia Email</Text>
                            <TouchableOpacity onPress={handleEmailUpdate} disabled={isUpdatingAuth}>
                                {isUpdatingAuth ? (
                                    <ActivityIndicator color={Colors.primary} size="small" />
                                ) : (
                                    <Text className="font-bold text-base" style={{ color: Colors.primary }}>Aggiorna</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1 p-6">
                            <View className="gap-6 pb-12">
                                <View>
                                    <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Nuova Email</Text>
                                    <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                        <TextInput
                                            value={newEmail}
                                            onChangeText={setNewEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            className="text-primary font-medium text-lg p-0"
                                            placeholder="Nuovo indirizzo email"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                    <Text className="text-secondary/60 text-xs mt-3 px-1 leading-5">
                                        Per motivi di sicurezza, riceverai un link di conferma al nuovo indirizzo. L'email non verrà cambiata finché non confermerai il link.
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Change Password Modal */}
            <Modal
                animationType="slide"
                visible={showChangePassword}
                onRequestClose={() => setShowChangePassword(false)}
                statusBarTranslucent={true}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                            <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                                <Text className="text-secondary font-bold text-base">Annulla</Text>
                            </TouchableOpacity>
                            <Text className="text-primary font-black text-lg">Cambia Password</Text>
                            <TouchableOpacity onPress={handlePasswordUpdate} disabled={isUpdatingAuth}>
                                {isUpdatingAuth ? (
                                    <ActivityIndicator color={Colors.primary} size="small" />
                                ) : (
                                    <Text className="font-bold text-base" style={{ color: Colors.primary }}>Aggiorna</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1 p-6">
                            <View className="gap-6 pb-12">
                                <View>
                                    <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Password Attuale</Text>
                                    <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                        <TextInput
                                            value={currentPassword}
                                            onChangeText={setCurrentPassword}
                                            secureTextEntry
                                            className="text-primary font-medium text-lg p-0"
                                            placeholder="••••••••"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Nuova Password</Text>
                                    <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                        <TextInput
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry
                                            className="text-primary font-medium text-lg p-0"
                                            placeholder="Almeno 6 caratteri"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Conferma Nuova Password</Text>
                                    <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100">
                                        <TextInput
                                            value={confirmNewPassword}
                                            onChangeText={setConfirmNewPassword}
                                            secureTextEntry
                                            className="text-primary font-medium text-lg p-0"
                                            placeholder="Ripeti la nuova password"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>

                                <Text className="text-secondary/60 text-xs mt-1 px-1 leading-5">
                                    Assicurati di usare una password robusta per proteggere il tuo account.
                                </Text>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}
