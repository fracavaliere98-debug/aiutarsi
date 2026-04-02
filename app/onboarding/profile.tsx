import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { OnboardingStepHeader } from "../../components/onboarding/OnboardingStepHeader";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Colors } from "../../constants/Colors";
import { useEffect, useState } from "react";
import { Camera, UserRound, Gift, Calendar, ChevronDown, Check } from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from "../../services/AuthService";
import { requestMediaLibraryPermission } from "../../utils/permissions";
import { CalendarPicker } from "../../components/CalendarPicker";
import {
    GENDER_OPTIONS,
    normalizeBirthDateInput,
    isoToBirthDateLabel,
    validateVolunteerDemographics,
    birthDateToIso,
    getAdultMaxDate,
} from "../../utils/profileDemographics";
import { trackError, trackEvent } from "../../utils/monitoring";

export default function OnboardingProfile() {
    const router = useRouter();
    const { updateUserProfile, logout, user } = useAuth();
    const { showToast } = useToast();
    const [bio, setBio] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);
    const [referralCode, setReferralCode] = useState("");
    const [gender, setGender] = useState<string>(user?.gender || "");
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [birthDateInput, setBirthDateInput] = useState(isoToBirthDateLabel(user?.date_of_birth));
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const checkPendingReferral = async () => {
            const pending = await AsyncStorage.getItem('@pending_referral_code');
            if (pending) {
                setReferralCode(pending);
                // Clear it so we don't keep it forever
                await AsyncStorage.removeItem('@pending_referral_code');
            }
        };
        checkPendingReferral();
    }, []);

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per scegliere la tua foto profilo.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            showToast("error", "Permesso galleria necessario.");
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
        }
    };

    // Retrieve all accumulated data
    const params = useLocalSearchParams();

    const finishOnboarding = async () => {
        console.log("[DEBUG] Onboarding Profile: Finishing...", params);

        const interests = params.interests ? JSON.parse(params.interests as string) : [];
        const skills = params.skills ? JSON.parse(params.skills as string) : [];
        const demographics = validateVolunteerDemographics({
            gender,
            birthDateInput,
        });

        if (!demographics.ok) {
            trackEvent("onboarding_profile_validation_failed", {
                role: user?.role || "VOLUNTEER",
                reason: demographics.error,
            });
            showToast("error", demographics.error);
            return;
        }

        // Resolve referral code if entered
        let referredById = undefined;
        if (referralCode && referralCode.trim()) {
            try {
                referredById = await authService.resolveReferralCode(referralCode.trim());
            } catch (e) {
                console.warn("Could not resolve referral code:", e);
            }
        }

        // FINAL SAVE
        setIsUploading(true);
        try {
            trackEvent("onboarding_profile_submit_started", {
                role: user?.role || "VOLUNTEER",
                hasAvatar: !!avatar,
                hasBio: !!bio.trim(),
                hasReferralCode: !!referralCode.trim(),
            });
            const success = await updateUserProfile({
                interests,
                skills,
                bio,
                gender: demographics.gender,
                date_of_birth: demographics.dateOfBirth,
                avatar_url: avatar || undefined,
                referred_by: referredById || undefined
            });

            if (success) {
                console.log("[DEBUG] Onboarding Profile: SAVE SUCCESS. Redirecting to welcome.");
                trackEvent("onboarding_profile_completed", {
                    role: user?.role || "VOLUNTEER",
                    interestsCount: interests.length,
                    skillsCount: skills.length,
                });
                showToast('success', 'Profilo completato!');
                router.replace("/onboarding/welcome" as any);
            }
        } catch (error: any) {
            console.error("[DEBUG] Onboarding Profile: SAVE FAILED", error);
            trackError(error, {
                source: "onboarding_profile_submit",
                role: user?.role || "VOLUNTEER",
                hasAvatar: !!avatar,
                hasBio: !!bio.trim(),
            }, {
                source: "onboarding_profile_submit",
                priority: "high",
                classification: "error_technical",
                issueName: "onboarding_profile_submit_failed",
            });
            alert("Errore salvataggio profilo: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <ScreenWrapper className="px-0 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <OnboardingStepHeader
                    title="Completa il profilo"
                    subtitle="Aggiungi una foto e due righe su di te. Bastano pochi dettagli per iniziare meglio."
                    onBack={() => router.back()}
                    onClose={() => logout()}
                />

                <View className="px-6">
                    <View className="bg-white rounded-[28px] p-5 border border-primary/10 shadow-sm mb-6">
                        <View className="mb-4">
                            <Text className="text-primary font-black text-base mb-1">Fatti riconoscere subito</Text>
                            <Text className="text-secondary text-xs leading-5">
                                Una foto e una bio breve rendono il profilo più umano e più credibile per gli enti.
                            </Text>
                        </View>

                        <View className="items-center">
                            <TouchableOpacity
                                onPress={pickImage}
                                disabled={isUploading}
                                className="w-32 h-32 bg-white rounded-full items-center justify-center border-2 border-dashed border-primary/25 relative shadow-sm overflow-hidden"
                            >
                                {avatar ? (
                                    <Image source={{ uri: avatar }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center justify-center">
                                        <UserRound size={38} color={Colors.primary} opacity={0.55} />
                                    </View>
                                )}
                                <View className="absolute bottom-0 right-0 bg-accent p-2 rounded-full">
                                    {isUploading ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Camera size={14} color="white" />
                                    )}
                                </View>
                            </TouchableOpacity>
                            <Text className="text-sm text-primary/70 mt-3 font-bold">Carica foto profilo</Text>
                            <Text className="text-[11px] text-secondary/70 mt-1 text-center">
                                Va bene anche una foto semplice, purché chiara.
                            </Text>
                        </View>
                    </View>

                    <View className="gap-4 mb-10">
                        <View className="bg-white rounded-[24px] p-4 border border-primary/10 shadow-sm">
                            <View className="flex-row items-center gap-2 mb-3">
                                <View className="w-8 h-8 rounded-full items-center justify-center bg-primary/10">
                                    <UserRound size={15} color={Colors.primary} />
                                </View>
                                <Text className="text-sm font-bold text-primary">Biografia</Text>
                            </View>
                            <TextInput
                                className="bg-background-light p-4 rounded-2xl border border-primary/10 text-primary h-32"
                                placeholder="Raccontaci qualcosa di te, le tue esperienze o perché vuoi fare volontariato..."
                                placeholderTextColor="#9ca3af"
                                multiline
                                textAlignVertical="top"
                                value={bio}
                                onChangeText={setBio}
                            />
                        </View>
                        <View className="bg-white rounded-[24px] p-4 border border-primary/10 shadow-sm">
                            <Text className="text-sm font-bold text-primary mb-3">Sesso</Text>
                            <View className="relative">
                                <TouchableOpacity
                                    onPress={() => setShowGenderDropdown((current) => !current)}
                                    className="bg-background-light px-4 py-4 rounded-2xl border border-primary/10 flex-row items-center justify-between"
                                >
                                    <Text className={`${gender ? "text-primary" : "text-secondary/60"} font-medium`}>
                                        {GENDER_OPTIONS.find((option) => option.value === gender)?.label || "Seleziona il sesso"}
                                    </Text>
                                    <ChevronDown size={18} color={Colors.primary} />
                                </TouchableOpacity>

                                {showGenderDropdown && (
                                    <View className="mt-2 bg-white border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
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
                        </View>
                        <View className="bg-white rounded-[24px] p-4 border border-primary/10 shadow-sm">
                            <Text className="text-sm font-bold text-primary mb-3">Data di nascita</Text>
                            <View className="flex-row items-center gap-2">
                                <TextInput
                                    className="flex-1 bg-background-light p-4 rounded-2xl border border-primary/10 text-primary"
                                    placeholder="GG/MM/AAAA"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="number-pad"
                                    value={birthDateInput}
                                    onChangeText={(value) => setBirthDateInput(normalizeBirthDateInput(value))}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowBirthDatePicker(true)}
                                    className="w-14 h-14 rounded-2xl border border-primary/15 bg-primary/10 items-center justify-center"
                                >
                                    <Calendar size={20} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <Text className="text-[11px] text-secondary/70 mt-2 leading-relaxed">
                                Campo obbligatorio. Devi avere almeno 18 anni.
                            </Text>
                        </View>
                        <View className="bg-white rounded-[24px] p-4 border border-primary/10 shadow-sm">
                            <View className="flex-row items-center gap-2 mb-3">
                                <View className="w-8 h-8 rounded-full items-center justify-center bg-accent/10">
                                    <Gift size={15} color={Colors.accent} />
                                </View>
                                <Text className="text-sm font-bold text-primary">Codice amico</Text>
                                <Text className="text-[11px] text-secondary">(Opzionale)</Text>
                            </View>
                            <TextInput
                                className="bg-background-light p-4 rounded-2xl border border-primary/10 text-primary"
                                placeholder="Inserisci il codice di chi ti ha invitato"
                                placeholderTextColor="#9ca3af"
                                value={referralCode}
                                onChangeText={setReferralCode}
                                autoCapitalize="characters"
                            />
                            <Text className="text-[11px] text-secondary/60 mt-1 ml-1 leading-relaxed">
                                Inserendo un codice amico, sbloccherete entrambi il badge &quot;Coppia Vincente&quot; e 500 XP dopo la tua prima missione.
                            </Text>
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
                            <Text className="text-white text-lg font-bold">Inizia l&apos;avventura</Text>
                        )}
                    </TouchableOpacity>
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
        </ScreenWrapper>
    );
}
