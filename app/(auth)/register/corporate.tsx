import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { BriefcaseBusiness, Lock, Mail, ShieldCheck } from "lucide-react-native";
import { useAuth } from "../../../context/AuthContext";
import { AuthShell } from "../../../components/auth/AuthShell";
import { AuthField } from "../../../components/auth/AuthField";
import { Button } from "../../../components/Button";
import { Colors } from "../../../constants/Colors";

export default function CorporateRegister() {
    const router = useRouter();
    const { register } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: "",
        vatId: "",
        email: "",
        password: "",
    });
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

    const handleRegister = async () => {
        if (!formData.companyName || !formData.vatId || !formData.email || !formData.password || !acceptedPrivacy) {
            Alert.alert("Attenzione", "Compila tutti i campi e accetta privacy e termini.");
            return;
        }

        setIsLoading(true);
        try {
            const result = await register({
                full_name: formData.companyName,
                email: formData.email,
                password: formData.password,
                role: "CORPORATE",
                companyName: formData.companyName,
            });

            if (result.requiresEmailConfirmation) {
                Alert.alert("Registrazione completata", "Controlla la tua email per continuare.");
                router.replace({
                    pathname: "/confirm-email",
                    params: {
                        email: formData.email.trim(),
                        role: "CORPORATE",
                    },
                });
                return;
            }

            router.replace("/(corporate)" as any);
        } catch (error: any) {
            Alert.alert("Errore", error.message || "Errore durante la registrazione.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Profilo azienda"
            title="Apri il profilo corporate."
            subtitle="Configura il team e inizia a esplorare attività da proporre ai collaboratori."
            backAction={() => router.back()}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={styles.formContent}
            >
                <AuthField
                    label="Ragione sociale"
                    placeholder="Azienda SpA"
                    value={formData.companyName}
                    onChangeText={(text) => setFormData({ ...formData, companyName: text })}
                    icon={<BriefcaseBusiness size={18} color={Colors.secondary} />}
                />

                <AuthField
                    label="Partita IVA"
                    placeholder="IT12345678901"
                    value={formData.vatId}
                    onChangeText={(text) => setFormData({ ...formData, vatId: text })}
                    icon={<ShieldCheck size={18} color={Colors.secondary} />}
                />

                <AuthField
                    label="Email aziendale"
                    placeholder="hr@azienda.com"
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
                    title={isLoading ? "Registrazione..." : "Crea account corporate"}
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
});
