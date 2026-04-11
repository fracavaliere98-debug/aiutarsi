import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MailCheck, ShieldCheck } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/Button";
import { Colors } from "../../constants/Colors";
import { supabase } from "../../utils/supabase";

function getRoleLabel(role?: string | string[]) {
    const normalized = Array.isArray(role) ? role[0] : role;
    if (normalized === "NPO") return "Ente";
    if (normalized === "CORPORATE") return "Azienda";
    return "Volontario";
}

function getStringParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value || "";
}

export default function ConfirmEmailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ email?: string | string[]; role?: string | string[]; type?: string | string[] }>();
    const { user, isLoaded, isLoading, resendSignupConfirmation, checkEmailConfirmationStatus } = useAuth();
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const email = getStringParam(params.email);
    const role = getStringParam(params.role);
    const authType = getStringParam(params.type);
    const roleLabel = useMemo(() => getRoleLabel(role), [role]);
    const isEmailChangeFlow = authType === "email_change" || authType === "email_change_current" || authType === "email_change_new";

    useEffect(() => {
        if (!isLoaded || isLoading || !user || isEmailChangeFlow) return;
        router.replace("/");
    }, [user, isLoaded, isLoading, router, isEmailChangeFlow]);

    const handleResend = async () => {
        if (!email || isResending) {
            showToast("error", "Email non disponibile per il reinvio.");
            return;
        }

        if (isEmailChangeFlow) {
            showToast("error", "Per richiedere una nuova mail di cambio indirizzo, ripeti l'operazione dalle impostazioni.");
            return;
        }

        try {
            setIsResending(true);
            await resendSignupConfirmation(email);
            showToast("success", "Ti abbiamo inviato una nuova mail di conferma.");
        } catch (error: any) {
            showToast("error", error?.message || "Non siamo riusciti a reinviare la mail di conferma.");
        } finally {
            setIsResending(false);
        }
    };

    const handleAlreadyConfirmed = async () => {
        if (isChecking || !email) return;

        try {
            setIsChecking(true);
            const isConfirmed = await checkEmailConfirmationStatus(email);
            if (isConfirmed) {
                Alert.alert(
                    isEmailChangeFlow ? "Email aggiornata" : "Email già confermata",
                    isEmailChangeFlow
                        ? "Il nuovo indirizzo email risulta già confermato. Ora puoi continuare a usare l'app."
                        : "La tua email risulta già confermata. Ora puoi procedere al login.",
                    [{ text: isEmailChangeFlow ? "Torna all'app" : "Vai al login", onPress: () => router.replace(isEmailChangeFlow ? "/" : "/login") }]
                );
                return;
            }

            if (isEmailChangeFlow) {
                Alert.alert(
                    "Cambio email non ancora completato",
                    "Il nuovo indirizzo non risulta ancora confermato. Se il link non è più valido, richiedi di nuovo il cambio email dalle impostazioni."
                );
                return;
            }

            await resendSignupConfirmation(email);
            Alert.alert(
                "Conferma non ancora rilevata",
                "La tua email non risulta ancora confermata. Ti abbiamo inviato una nuova mail di conferma."
            );

            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
                router.replace("/");
                return;
            }
        } catch (error: any) {
            Alert.alert(
                "Verifica non riuscita",
                error?.message || "Non siamo riusciti a controllare lo stato della conferma. Riprova tra poco."
            );
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <AuthShell
            eyebrow={isEmailChangeFlow ? "Cambio email" : `${roleLabel} in attesa di conferma`}
            title={isEmailChangeFlow ? "Conferma il nuovo indirizzo email." : "Controlla la tua email."}
            subtitle={
                isEmailChangeFlow
                    ? "Ti abbiamo inviato un link di conferma al nuovo indirizzo. Aprilo su questo dispositivo per completare il cambio email."
                    : "Ti abbiamo inviato un link di conferma. Aprilo su questo dispositivo e ti faremo entrare automaticamente nell'app."
            }
            backAction={() => router.back()}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
            >
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <MailCheck size={28} color={Colors.primary} />
                    </View>
                    <Text style={styles.cardTitle}>{isEmailChangeFlow ? "Ultimo passaggio" : "Quasi fatto"}</Text>
                    <Text style={styles.cardBody}>
                        Verifica la casella di posta di:
                    </Text>
                    <Text style={styles.email}>{email || "indirizzo email non disponibile"}</Text>
                    {!isEmailChangeFlow ? (
                        <View style={styles.rolePill}>
                            <ShieldCheck size={14} color={Colors.primary} />
                            <Text style={styles.roleText}>Ruolo: {roleLabel}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.actions}>
                    <Button
                        title={isResending ? "Invio..." : "Reinvia email"}
                        onPress={handleResend}
                        isLoading={isResending}
                        className="rounded-[28px]"
                    />
                    <Button
                        title={isChecking ? "Verifica..." : isEmailChangeFlow ? "Ho già cambiato email" : "Ho già confermato"}
                        onPress={handleAlreadyConfirmed}
                        isLoading={isChecking}
                        variant="outline"
                        className="rounded-[28px]"
                    />
                </View>

                <Text style={styles.hint}>
                    {isEmailChangeFlow
                        ? "Dopo il click sul link, il nuovo indirizzo verrà confermato. Se hai già completato il passaggio, puoi tornare alle impostazioni."
                        : "Appena apri il link di conferma e la sessione viene attivata, verrai reindirizzato automaticamente."}
                </Text>
            </ScrollView>
        </AuthShell>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
        flexGrow: 1,
        gap: 20,
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
        color: Colors.primary,
        textAlign: "center",
    },
    cardBody: {
        fontSize: 15,
        lineHeight: 22,
        color: "#5e5870",
        textAlign: "center",
    },
    email: {
        fontSize: 15,
        fontWeight: "800",
        color: "#25193d",
        textAlign: "center",
    },
    rolePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(70,34,130,0.06)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        marginTop: 4,
    },
    roleText: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    actions: {
        gap: 12,
    },
    hint: {
        fontSize: 13,
        lineHeight: 20,
        color: "#6f6880",
        textAlign: "center",
        paddingHorizontal: 12,
    },
});
