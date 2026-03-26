import React, { useState } from 'react';
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
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowRight, Camera, Globe, Info, Mail, Phone, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { UserAvatar } from '../../components/UserAvatar';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { requestMediaLibraryPermission } from '../../utils/permissions';

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
    const [publicEmail, setPublicEmail] = useState(user?.public_email || user?.publicEmail || "");
    const [address, setAddress] = useState(user?.address_full || "");
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(
        user?.location_lat && user?.location_lng 
            ? { lat: user.location_lat, lng: user.location_lng } 
            : null
    );

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
        if (!mission || !address || !vatId || !phone || !publicEmail) {
            showToast("error", "Compilate i campi obbligatori: missione, indirizzo, P.IVA/CF, email pubblica e telefono.");
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
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>MISSIONE / DESCRIZIONE *</Text>
                            <View style={[styles.inputContainer, styles.textAreaContainer]}>
                                <Info size={20} color={Colors.primary} style={styles.inputIcon} />
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
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>INDIRIZZO SEDE OPERATIVA *</Text>
                            <AddressAutocomplete 
                                initialValue={address}
                                onSelect={(addr, lat, lng) => {
                                    setAddress(addr);
                                    setCoords({ lat, lng });
                                }}
                                placeholder="Cerca indirizzo..."
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>P.IVA / CODICE FISCALE *</Text>
                            <View style={styles.inputContainer}>
                                <Globe size={20} color={Colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input}
                                    placeholder="Es. 12345678901"
                                    value={vatId}
                                    onChangeText={setVatId}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>EMAIL PUBBLICA *</Text>
                            <View style={styles.inputContainer}>
                                <Mail size={20} color={Colors.primary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="contatti@tuoente.org"
                                    value={publicEmail}
                                    onChangeText={setPublicEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>TELEFONO *</Text>
                            <View style={styles.inputContainer}>
                                <Phone size={20} color={Colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input}
                                    placeholder="Es. +39 02 1234567"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>SITO WEB</Text>
                            <View style={styles.inputContainer}>
                                <Search size={20} color={Colors.primary} style={styles.inputIcon} />
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
                        style={[styles.button, (!mission || !address || !vatId || !phone || !publicEmail) && styles.buttonDisabled]}
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
        backgroundColor: Colors.primary,
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
        color: Colors.secondary,
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
