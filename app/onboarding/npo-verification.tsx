import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowRight, FileText, Upload, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { storageService } from '../../services/StorageService';
import { authService } from '../../services/AuthService';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';

export default function NPOVerificationScreen() {
    const router = useRouter();
    const { user, updateUserProfile, logout } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [document, setDocument] = useState<DocumentPicker.DocumentPickerResult | null>(null);

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled) {
                setDocument(result);
            }
        } catch {
            showToast("error", "Errore nella selezione del documento.");
        }
    };

    const handleContinue = async () => {
        if (!document) {
            Alert.alert(
                "Verifica Posticipata",
                "Puoi continuare senza caricare i documenti ora, ma il tuo ente non riceverà il Bollino Viola finché il profilo non sarà verificato manualmente.",
                [
                    { text: "Carica ora", style: "cancel" },
                    { text: "Continua comunque", onPress: () => router.push('/onboarding/npo-preview') }
                ]
            );
            return;
        }

        setIsLoading(true);
        try {
            const asset = document.assets?.[0];
            if (!asset) {
                showToast("error", "Nessun file selezionato.");
                return;
            }
            const extension = asset.name?.split('.').pop() || 'pdf';
            console.log("[DEBUG] Uploading verification doc...", asset.uri);
            
            const uploadedUrl = await storageService.uploadVerificationDoc(user!.id, asset.uri, extension);
            
            if (uploadedUrl) {
                // Collect all NPO info for the admin request
                const npoDetailsSnap = {
                    vat_id: user?.npo_vat_id,
                    address: user?.address_full,
                    mission: user?.bio,
                    referent_name: user?.referent_name,
                    referent_role: user?.referent_role,
                    website: user?.website,
                    verification_doc: uploadedUrl,
                    timestamp: new Date().toISOString()
                };

                await updateUserProfile({
                    verification_doc_url: uploadedUrl,
                    verification_status: 'pending'
                } as any);

                await authService.submitVerificationRequest(user!.id, npoDetailsSnap);
                
                showToast("success", "Richiesta inviata! L'admin la revisionerà.");
                router.push('/onboarding/npo-preview');
            }
        } catch (e: any) {
            console.error("Upload verification failed", e);
            showToast("error", "Errore nel caricamento: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <OnboardingStepHeader
                    title="Verifica dell'ente"
                    subtitle="La verifica aumenta fiducia e visibilità. Puoi completarla ora oppure tornare più tardi."
                    onBack={() => router.back()}
                    onClose={() => logout()}
                />

                {/* Verification Badge Preview */}
                <View style={styles.badgePreview}>
                    <View style={styles.badgeIconContainer}>
                        <ShieldCheck size={48} color={Colors.primary} />
                        <View style={styles.miniBadge}>
                            <CheckCircle2 size={24} color="white" fill={Colors.accent} />
                        </View>
                    </View>
                    <Text style={styles.badgeTitle}>Bollino Viola</Text>
                    <Text style={styles.badgeDesc}>
                        Ottieni visibilità prioritaria e fiducia immediata dalla community di AiutarSì.
                    </Text>
                </View>

                {/* Upload Section */}
                <View style={styles.uploadSection}>
                    <Text style={styles.sectionTitle}>Documentazione Richiesta</Text>
                    <Text style={styles.sectionDesc}>
                        Caricate lo Statuto o l&apos;Atto Costitutivo dell&apos;ente (PDF o immagine).
                    </Text>

                    <TouchableOpacity 
                        onPress={pickDocument}
                        style={[styles.uploadBox, document && styles.uploadBoxActive]}
                    >
                        {document && document.assets?.[0] ? (
                            <View style={styles.fileInfo}>
                                <FileText size={32} color={Colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.fileName} numberOfLines={1}>
                                        {document.assets[0].name}
                                    </Text>
                                    <Text style={styles.fileSize}>
                                        {(document.assets[0].size! / 1024 / 1024).toFixed(2)} MB
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setDocument(null)}>
                                    <Text style={styles.removeText}>Cambia</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <Upload size={32} color={Colors.secondary} style={{ marginBottom: 12 }} />
                                <Text style={styles.uploadText}>Tocca per selezionare un file</Text>
                                <Text style={styles.formatText}>PDF o Immagini (max 5MB)</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Legal Disclaimer */}
                <View style={styles.disclaimerBox}>
                    <AlertCircle size={20} color="#606080" style={{ marginBottom: 8 }} />
                    <Text style={styles.disclaimerText}>
                        Dichiaro che i dati forniti e la documentazione caricata sono veritieri e riferiti all&apos;ente di cui sono rappresentante legale o delegato.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    onPress={handleContinue}
                    disabled={isLoading}
                    style={styles.button}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text style={styles.buttonText}>{document ? "Invia per Verifica" : "Salta per ora"}</Text>
                            <ArrowRight size={22} color="white" strokeWidth={2.5} />
                        </>
                    )}
                </TouchableOpacity>
            </View>
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
    badgePreview: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'white',
        marginHorizontal: 24,
        borderRadius: 32,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        marginBottom: 32,
    },
    badgeIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0F0FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    miniBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
    },
    badgeTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#8B5CF6', // Viola
        marginBottom: 8,
    },
    badgeDesc: {
        fontSize: 14,
        color: Colors.secondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    uploadSection: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1A1A40',
        marginBottom: 4,
    },
    sectionDesc: {
        fontSize: 14,
        color: '#8080A0',
        marginBottom: 16,
    },
    uploadBox: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#D1D1E0',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
    },
    uploadBoxActive: {
        borderStyle: 'solid',
        borderColor: Colors.primary,
        padding: 24,
    },
    uploadText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 4,
    },
    formatText: {
        fontSize: 12,
        color: Colors.secondary,
    },
    fileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
    },
    fileName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A40',
    },
    fileSize: {
        fontSize: 12,
        color: Colors.secondary,
    },
    removeText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.accent,
    },
    disclaimerBox: {
        marginHorizontal: 24,
        padding: 16,
        backgroundColor: '#F0F0F5',
        borderRadius: 16,
        alignItems: 'center',
    },
    disclaimerText: {
        fontSize: 12,
        color: '#606080',
        textAlign: 'center',
        lineHeight: 18,
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
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
