import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Lock, Mail } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/Button";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { Colors } from "../../constants/Colors";

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Attenzione", "Per favore inserisci email e password");
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
            router.replace("/");
        } catch (error: any) {
            Alert.alert("Errore di Accesso", error.message || "Login fallito. Riprova.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Bentornato"
            title="Accedi al tuo profilo."
            subtitle="Riprendi da dove avevi lasciato, con attività, messaggi e suggerimenti già pronti."
            backAction={() => router.back()}
            footer={(
                <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Non hai un account?</Text>
                    <TouchableOpacity onPress={() => router.push("/register/volunteer")} activeOpacity={0.8}>
                        <Text style={styles.footerLink}>Registrati</Text>
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
                    label="Email"
                    placeholder="mario.rossi@email.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    icon={<Mail size={18} color={Colors.secondary} />}
                />

                <AuthField
                    label="Password"
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    icon={<Lock size={18} color={Colors.secondary} />}
                />

                <TouchableOpacity style={styles.recoveryLinkWrap} activeOpacity={0.75}>
                    <Text style={styles.recoveryLink}>Password dimenticata?</Text>
                </TouchableOpacity>

                <Button
                    title="Accedi"
                    onPress={handleLogin}
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
    recoveryLinkWrap: {
        alignSelf: "flex-end",
        marginBottom: 16,
    },
    recoveryLink: {
        color: Colors.accent,
        fontSize: 13,
        fontWeight: "800",
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
