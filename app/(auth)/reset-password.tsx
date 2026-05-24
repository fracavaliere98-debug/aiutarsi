import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { KeyRound, ShieldCheck } from "lucide-react-native";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { getPasswordRequirementsShortText } from "../../utils/passwordValidation";
import { supabase } from "../../utils/supabase";
import { colors } from "@/theme";

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { completePasswordRecovery } = useAuth();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasRecoverySession, setHasRecoverySession] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (isMounted) {
                setHasRecoverySession(!!data.session?.user);
            }
        };

        void checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return;
            if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "USER_UPDATED") {
                setHasRecoverySession(!!session?.user);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async () => {
        if (!hasRecoverySession) {
            Alert.alert("Link richiesto", "Apri il link ricevuto via email su questo dispositivo per impostare la nuova password.");
            return;
        }

        if (!newPassword || !confirmPassword) {
            Alert.alert("Attenzione", "Inserisci e conferma la nuova password.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("Password diverse", "Le due password non coincidono.");
            return;
        }

        try {
            setIsSubmitting(true);
            await completePasswordRecovery(newPassword);
            Alert.alert("Password aggiornata", "La tua password è stata aggiornata correttamente.", [
                { text: "Continua", onPress: () => router.replace("/") },
            ]);
        } catch (error: any) {
            Alert.alert("Reset non riuscito", error?.message || "Non siamo riusciti ad aggiornare la password.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Recupero account"
            title="Imposta una nuova password."
            subtitle="Apri il link ricevuto via email su questo dispositivo, poi scegli la nuova password."
            backAction={() => router.back()}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
            >
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <KeyRound size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.cardTitle}>Reset password</Text>
                    <Text style={styles.cardBody}>
                        {hasRecoverySession
                            ? "Link verificato. Ora puoi impostare una nuova password."
                            : "In attesa del link di recupero. Aprilo su questo dispositivo per continuare."}
                    </Text>
                    <View style={styles.statusPill}>
                        <ShieldCheck size={14} color={colors.primary} />
                        <Text style={styles.statusText}>
                            {hasRecoverySession ? "Sessione di recupero attiva" : "Link non ancora rilevato"}
                        </Text>
                    </View>
                </View>

                <AuthField
                    label="Nuova password"
                    placeholder="Nuova password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    icon={<KeyRound size={18} color={colors.textSecondary} />}
                />

                <AuthField
                    label="Conferma password"
                    placeholder="Ripeti la nuova password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    icon={<KeyRound size={18} color={colors.textSecondary} />}
                />

                <Text style={styles.hint}>{getPasswordRequirementsShortText()}</Text>

                <Button
                    title={isSubmitting ? "Aggiornamento..." : "Aggiorna password"}
                    onPress={handleSubmit}
                    isLoading={isSubmitting}
                    className="rounded-[28px]"
                />
            </ScrollView>
        </AuthShell>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
        flexGrow: 1,
        gap: 18,
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.10)",
        shadowColor: "#2f1847",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
        alignItems: "center",
        gap: 10,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 22,
        backgroundColor: "rgba(70,34,130,0.08)",
        alignItems: "center",
        justifyContent: "center",
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: colors.primary,
        textAlign: "center",
    },
    cardBody: {
        fontSize: 15,
        lineHeight: 22,
        color: "#5e5870",
        textAlign: "center",
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(70,34,130,0.06)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        marginTop: 4,
    },
    statusText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    hint: {
        fontSize: 13,
        lineHeight: 20,
        color: "#6f6880",
        textAlign: "center",
        paddingHorizontal: 12,
    },
});
