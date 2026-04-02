import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Lock, Mail, User } from "lucide-react-native";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { AuthShell } from "../../../components/auth/AuthShell";
import { AuthField } from "../../../components/auth/AuthField";
import { Button } from "../../../components/Button";
import { Colors } from "../../../constants/Colors";
import { trackEvent } from "../../../utils/monitoring";

export default function VolunteerRegister() {
    const router = useRouter();
    const { register } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
    });
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

    const handleRegister = async () => {
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !acceptedPrivacy) {
            trackEvent("auth_register_validation_failed", {
                role: "VOLUNTEER",
                hasFirstName: !!formData.firstName,
                hasLastName: !!formData.lastName,
                hasEmail: !!formData.email,
                hasPassword: !!formData.password,
                acceptedPrivacy,
            });
            showToast("error", "Compila tutti i campi e accetta la Privacy.");
            return;
        }

        setIsLoading(true);
        try {
            const result = await register({
                full_name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                password: formData.password,
                role: "VOLUNTEER",
                profile_completed: false,
            });

            if (result.requiresEmailConfirmation) {
                showToast("success", "Registrazione completata. Conferma la tua email e poi accedi.");
                router.replace("/login");
                return;
            }

            router.replace("/onboarding/intro");
        } catch (error: any) {
            showToast("error", error.message || "Errore durante la registrazione.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Profilo volontario"
            title="Apri il tuo profilo e inizia subito."
            subtitle="Ti bastano pochi dati per partire. Gemma ti guiderà nei passaggi successivi."
            backAction={() => router.back()}
            footer={(
                <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Rappresenti un ente?</Text>
                    <TouchableOpacity onPress={() => router.push("/register/npo")} activeOpacity={0.8}>
                        <Text style={styles.footerLink}>Registrati come NPO</Text>
                    </TouchableOpacity>
                </View>
            )}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={styles.formContent}
            >
                <AuthField
                    label="Nome"
                    placeholder="Mario"
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                    icon={<User size={18} color={Colors.secondary} />}
                />

                <AuthField
                    label="Cognome"
                    placeholder="Rossi"
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                    icon={<User size={18} color={Colors.secondary} />}
                />

                <AuthField
                    label="Email"
                    placeholder="mario.rossi@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    icon={<Mail size={18} color={Colors.secondary} />}
                />

                <AuthField
                    label="Password"
                    placeholder="Crea una password sicura"
                    secureTextEntry
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    icon={<Lock size={18} color={Colors.secondary} />}
                />

                <TouchableOpacity
                    onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
                    style={styles.privacyRow}
                    activeOpacity={0.8}
                >
                    <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
                        {acceptedPrivacy ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                    <Text style={styles.privacyText}>
                        Accetto la{" "}
                        <Text onPress={() => router.push("/(corporate)/privacy-policy")} style={styles.inlineLink}>
                            Privacy Policy
                        </Text>
                        {" "}e i{" "}
                        <Text onPress={() => router.push("/terms" as any)} style={styles.inlineLink}>
                            Termini di Servizio
                        </Text>
                    </Text>
                </TouchableOpacity>

                <Button
                    title={isLoading ? "Registrazione..." : "Crea account"}
                    onPress={handleRegister}
                    isLoading={isLoading}
                    className="mt-2 rounded-[28px]"
                />
            </ScrollView>
        </AuthShell>
    );
}

const styles = StyleSheet.create({
    formContent: {
        paddingBottom: 24,
        flexGrow: 1,
    },
    privacyRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginTop: 4,
        marginBottom: 16,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "rgba(70,34,130,0.18)",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
        backgroundColor: "#fff",
    },
    checkboxChecked: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    checkboxTick: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
    },
    privacyText: {
        flex: 1,
        color: "#686177",
        fontSize: 13,
        lineHeight: 20,
        fontWeight: "500",
    },
    inlineLink: {
        color: Colors.primary,
        fontWeight: "800",
        textDecorationLine: "underline",
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
    },
    footerText: {
        color: "#6f6880",
        fontSize: 14,
        fontWeight: "500",
    },
    footerLink: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "900",
    },
});
