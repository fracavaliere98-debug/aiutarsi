import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowRight, Camera, Globe, Info, Mail, Phone, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { UserAvatar } from '../../components/UserAvatar';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { requestMediaLibraryPermission } from '../../utils/permissions';
import { getMissingRequiredFields, missingFieldsMessage } from '../../utils/requiredFields';
import { FieldError, RequiredFieldsNote, RequiredMark } from '../../components/ui';
import { colors } from "@/theme";

export default function NPODetailsScreen() {
    const router = useRouter();
    const { user, updateUserProfile, logout } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [logo, setLogo] = useState(user?.avatar || "");
    const [mission, setMission] = useState(user?.bio || "");
    const [website, setWebsite] = useState(user?.website || "");
    const [vatId, setVatId] = useState(user?.npo_vat_id || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [publicEmail, setPublicEmail] = useState(user?.public_email || user?.publicEmail || user?.email || "");
    const [address, setAddress] = useState(user?.address_full || "");
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(
        user?.location_lat && user?.location_lng 
            ? { lat: user.location_lat, lng: user.location_lng } 
            : null
    );

    // Campi obbligatori: asterisco rosso sull'etichetta; dopo il primo "Continua" ogni campo vuoto
    // mostra il suo messaggio e la schermata scorre fino al primo mancante.
    const scrollRef = useRef<ScrollView>(null);
    const formY = useRef(0);
    const fieldY = useRef<Record<string, number>>({});
    const [showErrors, setShowErrors] = useState(false);
    const requiredFields = [
        { key: 'mission', label: 'Missione', value: mission },
        { key: 'address', label: 'Indirizzo della sede', value: address },
        { key: 'vatId', label: 'P.IVA / Codice fiscale', value: vatId },
        { key: 'publicEmail', label: 'Email pubblica', value: publicEmail },
        { key: 'phone', label: 'Telefono', value: phone },
    ] as const;
    const missingFields = getMissingRequiredFields([...requiredFields]);
    const isMissing = (key: string) => showErrors && missingFields.some((field) => field.key === key);
    const FIELD_ERRORS: Record<string, string> = {
        mission: 'Scrivete in breve chi siete e cosa fate.',
        address: "Cercate e scegliete l'indirizzo della sede.",
        vatId: 'Inserite la partita IVA o il codice fiscale.',
        publicEmail: "Inserite l'email che i volontari possono usare per contattarvi.",
        phone: 'Inserite un numero di telefono.',
    };
    const errorFor = (key: string) => (isMissing(key) ? FIELD_ERRORS[key] : null);
    const rememberY = (key: string) => (event: { nativeEvent: { layout: { y: number } } }) => {
        fieldY.current[key] = event.nativeEvent.layout.y;
    };

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: 'Accesso alla galleria',
            message: 'AiutarSi ti chiede l’accesso alla galleria per caricare il logo del tuo ente.',
            settingsLabel: 'la galleria',
        });
        if (!granted) {
            showToast("error", "Permesso galleria necessario.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setLogo(result.assets[0].uri);
        }
    };

    const handleContinue = async () => {
        if (missingFields.length > 0) {
            setShowErrors(true);
            const firstY = fieldY.current[missingFields[0].key];
            if (firstY !== undefined) {
                scrollRef.current?.scrollTo({ y: Math.max(formY.current + firstY - 16, 0), animated: true });
            }
            showToast("warning", missingFieldsMessage(missingFields));
            return;
        }

        setIsLoading(true);
        try {
            await updateUserProfile({
                bio: mission,
                website: website,
                npo_vat_id: vatId,
                phone: phone,
                publicEmail,
                address_full: address,
                location_lat: coords?.lat,
                location_lng: coords?.lng,
                avatar_url: logo, // AuthService handles the upload
                avatar: logo, // Legacy sync
            } as any);
            router.push('/onboarding/npo-referent');
        } catch (e: any) {
            showToast("error", e.message || "Errore durante il salvataggio.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <OnboardingStepHeader
                        title="Dettagli dell'ente"
                        subtitle="Missione, sede e contatti: i dati essenziali per presentare bene il vostro profilo."
                        onBack={() => router.back()}
                        onClose={() => logout()}
                    />

                    {/* Logo Upload */}
                    <View style={styles.logoSection}>
                        <TouchableOpacity onPress={pickImage} style={styles.logoWrapper}>
                            <UserAvatar 
                                size={120} 
                                name={user?.npo_name || "NPO"} 
                                avatarUrl={logo}
                                fontSize={40}
                            />
                            <View style={styles.cameraIcon}>
                                <Camera size={20} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.logoHint}>Caricate il Logo</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form} onLayout={(event) => { formY.current = event.nativeEvent.layout.y; }}>
                        <RequiredFieldsNote />
                        <View style={styles.inputGroup} onLayout={rememberY('mission')}>
                            <Text style={styles.inputLabel}>MISSIONE / DESCRIZIONE<RequiredMark /></Text>
                            <View style={[styles.inputContainer, styles.textAreaContainer, isMissing('mission') && styles.inputContainerError]}>
                                <Info size={20} color={colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Raccontate brevemente chi siete e cosa fate..."
                                    value={mission}
                                    onChangeText={setMission}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                            <FieldError message={errorFor('mission')} />
                        </View>

                        <View style={styles.inputGroup} onLayout={rememberY('address')}>
                            <Text style={styles.inputLabel}>INDIRIZZO SEDE OPERATIVA<RequiredMark /></Text>
                            <AddressAutocomplete 
                                initialValue={address}
                                onSelect={(addr, lat, lng) => {
                                    setAddress(addr);
                                    setCoords({ lat, lng });
                                }}
                                placeholder="Cerca indirizzo..."
                            />
                            <FieldError message={errorFor('address')} />
                        </View>

                        <View style={styles.inputGroup} onLayout={rememberY('vatId')}>
                            <Text style={styles.inputLabel}>P.IVA / CODICE FISCALE<RequiredMark /></Text>
                            <View style={[styles.inputContainer, !!vatId && styles.inputContainerDisabled, isMissing('vatId') && styles.inputContainerError]}>
                                <Globe size={20} color={colors.primary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, !!vatId && styles.inputDisabled]}
                                    placeholder="Es. 12345678901"
                                    value={vatId}
                                    onChangeText={setVatId}
                                    editable={!vatId}
                                />
                            </View>
                            {!!vatId && (
                                <Text style={styles.inputHint}>Inserito in fase di registrazione, non modificabile.</Text>
                            )}
                            <FieldError message={errorFor('vatId')} />
                        </View>

                        <View style={styles.inputGroup} onLayout={rememberY('publicEmail')}>
                            <Text style={styles.inputLabel}>EMAIL PUBBLICA<RequiredMark /></Text>
                            <View style={[styles.inputContainer, isMissing('publicEmail') && styles.inputContainerError]}>
                                <Mail size={20} color={colors.primary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="contatti@tuoente.org"
                                    value={publicEmail}
                                    onChangeText={setPublicEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                            <FieldError message={errorFor('publicEmail')} />
                        </View>

                        <View style={styles.inputGroup} onLayout={rememberY('phone')}>
                            <Text style={styles.inputLabel}>TELEFONO<RequiredMark /></Text>
                            <View style={[styles.inputContainer, isMissing('phone') && styles.inputContainerError]}>
                                <Phone size={20} color={colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input}
                                    placeholder="Es. +39 02 1234567"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <FieldError message={errorFor('phone')} />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>SITO WEB</Text>
                            <View style={styles.inputContainer}>
                                <Search size={20} color={colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input}
                                    placeholder="https://www.tuoente.org"
                                    value={website}
                                    onChangeText={setWebsite}
                                    keyboardType="url"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity 
                        onPress={handleContinue}
                        disabled={isLoading}
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Continua</Text>
                                <ArrowRight size={22} color="white" strokeWidth={2.5} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    scrollContent: {
        paddingBottom: 120,
    },
    logoSection: {
        alignItems: 'center',
        marginVertical: 20,
    },
    logoWrapper: {
        position: 'relative',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'white',
    },
    logoHint: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    form: {
        paddingHorizontal: 24,
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#A0A0B0',
        letterSpacing: 1,
        marginLeft: 4,
    },
    inputContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        borderWidth: 1.5,
        borderColor: '#E8E8F0',
    },
    inputIcon: {
        marginRight: 12,
        opacity: 0.6,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1A1A40',
        fontWeight: '500',
    },
    inputContainerError: {
        borderColor: colors.dangerStrong,
    },
    inputContainerDisabled: {
        backgroundColor: '#F1F1F6',
    },
    inputDisabled: {
        color: '#8A8A9C',
    },
    inputHint: {
        fontSize: 12,
        color: '#A0A0B0',
        marginLeft: 4,
        marginTop: 2,
    },
    textAreaContainer: {
        alignItems: 'flex-start',
        paddingTop: 16,
    },
    textArea: {
        height: 100,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 30,
        backgroundColor: 'rgba(248,249,251,0.95)',
        flexDirection: 'row',
        gap: 16,
    },
    button: {
        flex: 1,
        backgroundColor: '#352F8B',
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        elevation: 5,
        shadowColor: '#352F8B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    buttonDisabled: {
        backgroundColor: '#D1D1E0',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
