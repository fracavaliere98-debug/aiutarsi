import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Camera, Calendar, ChevronDown, Check, Save, User as UserIcon } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { UserAvatar } from "../../../components/UserAvatar";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { requestForegroundLocationPermission, requestMediaLibraryPermission } from "../../../utils/permissions";
import { storageService } from "../../../services/StorageService";
import { CalendarPicker } from "../../../components/CalendarPicker";
import {
    GENDER_OPTIONS,
    normalizeBirthDateInput,
    birthDateToIso,
    isoToBirthDateLabel,
    validateVolunteerDemographics,
    getAdultMaxDate,
} from "../../../utils/profileDemographics";
import { colors } from "@/theme";

const IMAGE_PICKER_MEDIA_TYPES =
    (ImagePicker as any).MediaType?.images
        ? [(ImagePicker as any).MediaType.images]
        : ['images'];

export default function VolunteerEditProfileScreen({ onClose }: { onClose?: () => void }) {
    const { user, updateUserProfile } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();

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
    const [isSaving, setIsSaving] = useState(false);

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

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per aggiornare la tua foto profilo.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            showToast('error', 'Permesso galleria necessario.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: IMAGE_PICKER_MEDIA_TYPES as any,
            allowsEditing: true,
            aspect: [1, 1],
            // 0.5 basta per un avatar mostrato piccolo e circolare: qualità più alta produce
            // file da diversi MB la cui codifica base64 (sincrona, sul thread JS) può richiedere
            // decine di secondi su device meno potenti, dando l'impressione di un blocco.
            quality: 0.5,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
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

            showToast('success', 'Profilo salvato correttamente');
            if (onClose) onClose();
            else router.back();
        } catch (error: any) {
            showToast('error', error.message || "Errore durante il salvataggio.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <StandardLayout title="Modifica Profilo" label="Impostazioni" onBack={onClose || (() => router.back())}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                {/* Avatar Section */}
                <View className="items-center mb-8 mt-2">
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.8} className="relative">
                        {avatar || user?.avatar ? (
                            <View className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/10">
                                <Image source={{ uri: avatar || user?.avatar }} className="w-full h-full" />
                            </View>
                        ) : (
                            <UserAvatar size={100} fontSize={32} useAuthFallback />
                        )}
                        <View className="absolute bottom-0 right-0 bg-primary p-2.5 rounded-full border-4 border-gray-50">
                            <Camera size={16} color="white" />
                        </View>
                    </TouchableOpacity>
                    <Text className="text-secondary text-xs mt-3 font-medium">Tocca per cambiare foto</Text>
                </View>

                {/* Form Fields */}
                <SoftCard className="p-6 mb-24">
                    <InputField label="Nome" value={firstName} onChangeText={setFirstName} placeholder="Il tuo nome" icon={UserIcon} />
                    <InputField label="Cognome" value={lastName} onChangeText={setLastName} placeholder="Il tuo cognome" icon={UserIcon} />

                    <View className="mb-4">
                        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">Sesso</Text>
                        <View className={`bg-white border border-gray-200 rounded-2xl overflow-hidden ${user?.gender ? "bg-gray-100" : ""}`}>
                            {user?.gender ? (
                                <View className="px-4 py-3">
                                    <Text className="text-secondary font-medium text-base">
                                        {GENDER_OPTIONS.find((option) => option.value === user.gender)?.label || user.gender}
                                    </Text>
                                </View>
                            ) : (
                                <View className="relative">
                                    <TouchableOpacity
                                        onPress={() => setShowGenderDropdown((current) => !current)}
                                        className="px-4 py-3 flex-row items-center justify-between"
                                        style={{ minHeight: 52 }}
                                    >
                                        <Text className={`${gender ? "text-primary" : "text-secondary/60"} font-medium text-base`}>
                                            {GENDER_OPTIONS.find((option) => option.value === gender)?.label || "Seleziona il sesso"}
                                        </Text>
                                        <ChevronDown size={18} color={colors.primary} />
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
                                                        className={`px-4 py-3 flex-row items-center justify-between ${index < GENDER_OPTIONS.length - 1 ? "border-b border-primary/5" : ""}`}
                                                    >
                                                        <Text className={`${selected ? "text-primary" : "text-secondary"} font-medium`}>
                                                            {option.label}
                                                        </Text>
                                                        {selected ? <Check size={16} color={colors.primary} /> : null}
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

                    <View className="mb-4">
                        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">Data di nascita</Text>
                        <View
                            className={`px-4 rounded-2xl border border-gray-200 ${user?.date_of_birth ? "bg-gray-100" : "bg-white"}`}
                            style={{ minHeight: 52, justifyContent: 'center', paddingVertical: 10 }}
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
                                        <Calendar size={15} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        <Text className="text-secondary/60 text-xs mt-2 ml-1">
                            {user?.date_of_birth ? "Questo dato non può più essere modificato." : "Devi avere almeno 18 anni. Una volta salvata, non potrai più modificarla."}
                        </Text>
                    </View>

                    <InputField
                        label="Biografia"
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Raccontaci qualcosa di te..."
                        icon={UserIcon}
                        multiline
                    />

                    <InputField
                        label="Telefono"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+39..."
                        icon={UserIcon}
                        keyboardType="phone-pad"
                    />

                    <View className="mb-1">
                        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">Località</Text>
                        <View className="bg-gray-100 px-4 py-3 rounded-2xl border border-gray-100">
                            <Text className="text-secondary font-medium text-base italic">{locationInput}</Text>
                        </View>
                        <Text className="text-secondary/60 text-xs mt-2 ml-1">La località viene aggiornata automaticamente.</Text>
                    </View>
                </SoftCard>
            </KeyboardAvoidingView>

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

            {/* Floating Save Button */}
            <View className="absolute bottom-6 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    className="bg-accent py-4 rounded-[24px] flex-row justify-center items-center shadow-lg shadow-accent/40 active:scale-95"
                >
                    {isSaving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Save size={20} color="white" className="mr-2" />
                            <Text className="text-white font-black text-lg">Salva Modifiche</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}

const InputField = ({
    label,
    value,
    onChangeText,
    placeholder,
    icon: Icon,
    multiline = false,
    keyboardType = "default" as any
}: {
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: any,
    multiline?: boolean,
    keyboardType?: any
}) => (
    <View className="mb-4">
        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">{label}</Text>
        <View className={`bg-white border border-gray-200 rounded-2xl flex-row items-${multiline ? 'start' : 'center'} px-4 py-3 focus:border-primary`}>
            <View className={`mr-3 ${multiline ? 'mt-1' : ''}`}>
                <Icon size={20} color={colors.textSecondary} />
            </View>
            <TextInput
                className={`flex-1 text-primary font-medium text-base ${multiline ? 'h-24 pb-2' : ''}`}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                multiline={multiline}
                textAlignVertical={multiline ? "top" : "center"}
                keyboardType={keyboardType}
            />
        </View>
    </View>
);
