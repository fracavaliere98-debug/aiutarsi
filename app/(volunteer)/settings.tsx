import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { getPasswordRequirementsText, getPasswordRequirementsShortText, isPasswordStrongEnough } from "../../utils/passwordValidation";
import { LogOut, ChevronRight, Shield, HelpCircle, Heart, Camera, User, FileText, Database, ShieldBan, Users, Mail, Lock, ChartColumnIncreasing, Calendar, ChevronDown, Check } from 'lucide-react-native';
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
import { requestForegroundLocationPermission, requestMediaLibraryPermission } from "../../utils/permissions";
import { storageService } from "../../services/StorageService";
import { CalendarPicker } from "../../components/CalendarPicker";
import { reportIssue } from "../../utils/monitoring";
import {
    GENDER_OPTIONS,
    normalizeBirthDateInput,
    birthDateToIso,
    isoToBirthDateLabel,
    validateVolunteerDemographics,
    getAdultMaxDate,
} from "../../utils/profileDemographics";

const IMAGE_PICKER_MEDIA_TYPES =
    (ImagePicker as any).MediaType?.images
        ? [(ImagePicker as any).MediaType.images]
        : ['images'];

export default function VolunteerSettings() {
    const insets = useSafeAreaInsets();
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
    const [gender, setGender] = useState(user?.gender || "");
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [birthDateInput, setBirthDateInput] = useState(isoToBirthDateLabel(user?.date_of_birth));
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Change Email/Password states
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [emailUpdateNotice, setEmailUpdateNotice] = useState<string | null>(null);
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
            showToast('success', "Ti abbiamo inviato un link di conferma al nuovo indirizzo email.");
            setEmailUpdateNotice("Ti abbiamo inviato un link di conferma al nuovo indirizzo email.");
            Alert.alert(
                "Controlla la nuova email",
                "Ti abbiamo inviato un link di conferma al nuovo indirizzo. Il cambio sarà completato dopo la conferma.",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            setShowChangeEmail(false);
                        },
                    },
                ]
            );
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
        if (!isPasswordStrongEnough(newPassword)) {
            Alert.alert("Errore", getPasswordRequirementsText());
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
            mediaTypes: IMAGE_PICKER_MEDIA_TYPES as any,
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
            setGender(user.gender || "");
            setShowGenderDropdown(false);
            setBirthDateInput(isoToBirthDateLabel(user.date_of_birth));
            if (user.locationString) setLocationInput(user.locationString);
        }
    }, [user]);

    // Automatic location fetching for display only.
    // Do not auto-save from this screen: profile writes should happen only on explicit user actions.
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
                const granted = await requestForegroundLocationPermission({
                    title: "Accesso alla posizione",
                    message: "AiutarSi usa la tua posizione per proporti attivita vicine e compilare il profilo in modo piu utile.",
                    settingsLabel: "la posizione",
                });
                if (!granted) {
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
    }, [user?.locationString]);

    const saveProfile = async () => {
        setIsSaving(true);
        try {
            if (!user?.id) {
                throw new Error("Utente non disponibile.");
            }

            const currentGender = user?.gender || "";
            const currentBirthDate = user?.date_of_birth || "";
            const demographics = validateVolunteerDemographics({
                gender,
                birthDateInput,
                existingGender: currentGender,
                existingDateOfBirth: currentBirthDate,
            });

            if (!demographics.ok) {
                throw new Error(demographics.error);
            }

            let avatarUrl = user.avatar_url || user.avatar || null;
            if (avatar && (avatar.startsWith('file://') || avatar.startsWith('content://') || avatar.startsWith('data:'))) {
                avatarUrl = await storageService.uploadAvatar(user.id, avatar);
            } else if (avatar) {
                avatarUrl = avatar;
            }

            const fullName = `${firstName} ${lastName}`.trim();

            await updateUserProfile({
                full_name: fullName,
                bio,
                phone,
                ...(currentGender ? {} : { gender: demographics.gender }),
                ...(currentBirthDate ? {} : { date_of_birth: demographics.dateOfBirth }),
                avatar_url: avatarUrl,
                name: fullName,
            });
            console.log("[DEBUG] VolunteerSettings: saveProfile updateUserProfile resolved");

            setShowEditProfile(false);
            setAvatar(null);
            setFirstName(fullName.split(" ")[0] || "");
            setLastName(fullName.split(" ").slice(1).join(" "));
            showToast('success', 'Profilo salvato correttamente');
            console.log("[DEBUG] VolunteerSettings: saveProfile success UI updated");
        } catch (error: any) {
            alert("Errore salvataggio profilo: " + error.message);
        } finally {
            console.log("[DEBUG] VolunteerSettings: saveProfile finally setIsSaving false");
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
        last = false,
        testID,
    }: {
        icon: any,
        label: string,
        color: string,
        onPress?: () => void,
        last?: boolean,
        testID?: string,
    }) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`flex-row items-center justify-between py-4 ${!last ? 'border-b border-gray-50' : ''}`}
            testID={testID}
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
                    />
                    <MenuItem
                        icon={ChartColumnIncreasing}
                        label="Report"
                        color={Colors.accent}
                        onPress={() => router.push("/(volunteer)/report" as any)}
                        testID="volunteer-settings-report"
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
                        icon={Mail}
                        label="Segnala un problema"
                        color={Colors.accent}
                        onPress={() => {
                            void reportIssue({
                                user,
                                screen: "volunteer_settings",
                            });
                        }}
                    />
                    <MenuItem
                        icon={FileText}
                        label="Termini e Condizioni"
                        color={Colors.primary}
                        onPress={() => router.push("/terms" as any)}
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
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['bottom']}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                    <View
                        className="flex-row items-center justify-between px-6 pb-4 border-b border-gray-100"
                        style={{ paddingTop: Math.max(insets.top + 12, 24) }}
                    >
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

                            <View className="flex-row gap-3">
                            <View style={{ flex: 1 }}>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Sesso</Text>
                                <View className={`rounded-2xl shadow-sm border ${user?.gender ? "bg-gray-100 border-gray-100" : "bg-gray-50 border-gray-100"} overflow-hidden`}>
                                    {user?.gender ? (
                                        <View className="p-4">
                                            <Text className="text-secondary font-medium text-base">
                                                {GENDER_OPTIONS.find((option) => option.value === user.gender)?.label || user.gender}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View className="relative">
                                            <TouchableOpacity
                                                onPress={() => setShowGenderDropdown((current) => !current)}
                                                className="px-4 py-4 flex-row items-center justify-between"
                                                style={{ minHeight: 56 }}
                                            >
                                                <Text className={`${gender ? "text-primary" : "text-secondary/60"} font-medium`}>
                                                    {GENDER_OPTIONS.find((option) => option.value === gender)?.label || "Seleziona il sesso"}
                                                </Text>
                                                <ChevronDown size={18} color={Colors.primary} />
                                            </TouchableOpacity>
                                            {showGenderDropdown && (
                                                <View className="border-t border-primary/5 bg-white">
                                                    {GENDER_OPTIONS.map((option, index) => {
                                                        const selected = gender === option.value;
                                                        return (
                                                            <TouchableOpacity
                                                                key={option.value}
                                                                onPress={() => {
                                                                    setGender(option.value);
                                                                    setShowGenderDropdown(false);
                                                                }}
                                                                className={`px-4 py-4 flex-row items-center justify-between ${index < GENDER_OPTIONS.length - 1 ? "border-b border-primary/5" : ""}`}
                                                            >
                                                                <Text className={`${selected ? "text-primary" : "text-secondary"} font-medium`}>
                                                                    {option.label}
                                                                </Text>
                                                                {selected ? <Check size={16} color={Colors.primary} /> : null}
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                                <Text className="text-secondary/60 text-xs mt-2 ml-1">
                                    {user?.gender ? "Questo dato non può più essere modificato." : "Questo dato potrà essere salvato una sola volta."}
                                </Text>
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Data di nascita</Text>
                                <View
                                    className={`px-4 rounded-2xl shadow-sm border ${user?.date_of_birth ? "bg-gray-100 border-gray-100" : "bg-gray-50 border-gray-100"}`}
                                    style={{ minHeight: 56, justifyContent: 'center', paddingVertical: 12 }}
                                >
                                    {user?.date_of_birth ? (
                                        <Text className="text-secondary font-medium" style={{ lineHeight: 20 }}>{isoToBirthDateLabel(user.date_of_birth)}</Text>
                                    ) : (
                                        <View className="flex-row items-center gap-2">
                                            <TextInput
                                                value={birthDateInput}
                                                onChangeText={(value) => setBirthDateInput(normalizeBirthDateInput(value))}
                                                keyboardType="number-pad"
                                                placeholder="GG/MM/AAAA"
                                                placeholderTextColor="#9ca3af"
                                                className="flex-1 text-primary font-medium p-0"
                                                style={{ paddingVertical: 0, lineHeight: 20, fontSize: 16 }}
                                            />
                                            <TouchableOpacity
                                                onPress={() => setShowBirthDatePicker(true)}
                                                className="w-8 h-8 rounded-lg border border-primary/15 bg-primary/10 items-center justify-center"
                                            >
                                                <Calendar size={15} color={Colors.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                                <Text className="text-secondary/60 text-xs mt-2 ml-1">
                                    {user?.date_of_birth ? "Questo dato non può più essere modificato." : "Devi avere almeno 18 anni. Una volta salvata, non potrai più modificarla."}
                                </Text>
                            </View>
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2 ml-1">Biografia</Text>
                                <View className="p-4 rounded-2xl shadow-sm border bg-gray-50 border-gray-100 min-h-[160px]">
                                    <TextInput
                                        value={bio}
                                        onChangeText={setBio}
                                        multiline
                                        numberOfLines={5}
                                        placeholder="Raccontaci qualcosa di te..."
                                        placeholderTextColor="#9ca3af"
                                        className="text-base text-primary font-medium p-0 min-h-[128px]"
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
                    <CalendarPicker
                        visible={showBirthDatePicker}
                        value={birthDateToIso(birthDateInput) || ""}
                        onClose={() => setShowBirthDatePicker(false)}
                        maxDate={getAdultMaxDate()}
                        minDate={new Date("1920-01-01T00:00:00")}
                        onSelect={(from) => {
                            setBirthDateInput(isoToBirthDateLabel(from));
                            setShowBirthDatePicker(false);
                        }}
                    />
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
            
            {/* Change Email Modal */}
            <Modal
                animationType="slide"
                visible={showChangeEmail}
                onRequestClose={() => setShowChangeEmail(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['bottom']}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View
                            className="flex-row items-center justify-between px-6 pb-4 border-b border-gray-100"
                            style={{ paddingTop: Math.max(insets.top + 12, 24) }}
                        >
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
                                        Per motivi di sicurezza, riceverai un link di conferma al nuovo indirizzo. L&apos;email non verrà cambiata finché non confermerai il link.
                                    </Text>
                                    {emailUpdateNotice ? (
                                        <View className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                                            <Text className="text-green-800 text-sm font-semibold">{emailUpdateNotice}</Text>
                                        </View>
                                    ) : null}
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
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['bottom']}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View
                            className="flex-row items-center justify-between px-6 pb-4 border-b border-gray-100"
                            style={{ paddingTop: Math.max(insets.top + 12, 24) }}
                        >
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
                                            placeholder="8+ caratteri, 1 maiuscola, 1 numero"
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
                                    {getPasswordRequirementsShortText()}
                                </Text>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}
