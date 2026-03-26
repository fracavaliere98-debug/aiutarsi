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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowRight, Camera, MessageCircle, User } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { UserAvatar } from '../../components/UserAvatar';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { requestMediaLibraryPermission } from '../../utils/permissions';

export default function NPOReferentScreen() {
    const router = useRouter();
    const { user, updateUserProfile, logout } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState(user?.referent_name || "");
    const [role, setRole] = useState(user?.referent_role || "");
    const [avatar, setAvatar] = useState(user?.referent_avatar_url || "");
    const [welcomeMessage, setWelcomeMessage] = useState(
        user?.auto_welcome_message || 
        "Ciao! Grazie per esserti unito alla nostra missione. Ti ricontatteremo al più presto per coordinarci. A presto!"
    );

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: 'Accesso alla galleria',
            message: 'AiutarSi ti chiede l’accesso alla galleria per aggiungere la foto del referente.',
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
            setAvatar(result.assets[0].uri);
        }
    };

    const handleContinue = async () => {
        if (!name || !role) {
            showToast("error", "Inserite il nome e il ruolo del referente.");
            return;
        }

        setIsLoading(true);
        try {
            await updateUserProfile({
                referent_name: name,
                referent_role: role,
                referent_avatar_url: avatar,
                auto_welcome_message: welcomeMessage,
            } as any);
            router.push('/onboarding/npo-verification');
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
                >
                    <OnboardingStepHeader
                        title="Chi accoglie i volontari?"
                        subtitle="Presenta il referente dell'ente. Rende il profilo più umano e più chiaro per chi si candida."
                        onBack={() => router.back()}
                        onClose={() => logout()}
                    />

                    {/* Referent Photo */}
                    <View style={styles.photoSection}>
                        <TouchableOpacity onPress={pickImage} style={styles.photoWrapper}>
                            <UserAvatar 
                                size={120} 
                                name={name || "Referente"} 
                                avatarUrl={avatar}
                                fontSize={40}
                            />
                            <View style={styles.cameraIcon}>
                                <Camera size={20} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.photoHint}>Foto Referente</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>NOME E COGNOME REFERENTE *</Text>
                            <View style={styles.inputContainer}>
                                <User size={20} color={Colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input}
                                    placeholder="Es. Mario Rossi"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>RUOLO NELL&apos;ORGANIZZAZIONE *</Text>
                            <View style={styles.inputContainer}>
                                <User size={20} color={Colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.input}
                                    placeholder="Es. Coordinatore Volontari"
                                    value={role}
                                    onChangeText={setRole}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>MESSAGGIO DI BENVENUTO AUTOMATICO</Text>
                            <Text style={styles.helperText}>
                                Verrà inviato automaticamente in chat ai volontari che accetterete per i vostri progetti.
                            </Text>
                            <View style={[styles.inputContainer, styles.textAreaContainer]}>
                                <MessageCircle size={20} color={Colors.primary} style={styles.inputIcon} />
                                <TextInput 
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Scrivi un messaggio di benvenuto..."
                                    value={welcomeMessage}
                                    onChangeText={setWelcomeMessage}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity 
                        onPress={handleContinue}
                        disabled={isLoading}
                        style={[styles.button, (!name || !role) && styles.buttonDisabled]}
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
    photoSection: {
        alignItems: 'center',
        marginVertical: 20,
    },
    photoWrapper: {
        position: 'relative',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#E31B5D', // Accent color
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'white',
    },
    photoHint: {
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
    helperText: {
        fontSize: 13,
        color: '#8080A0',
        lineHeight: 18,
        marginBottom: 4,
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
