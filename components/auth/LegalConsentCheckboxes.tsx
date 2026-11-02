import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme";

// Registrazione: due caselle separate e obbligatorie (Privacy Policy, Termini e Condizioni).
// Senza entrambe la registrazione non parte (controllo nelle tre schermate di registrazione,
// poi in AuthContext e AuthService). La versione accettata viene salvata dal server
// (tabella legal_acceptances) con le costanti di shared/termsContent.ts e shared/privacyPolicyContent.ts.
interface Props {
    acceptedPrivacy: boolean;
    acceptedTerms: boolean;
    onChangePrivacy: (value: boolean) => void;
    onChangeTerms: (value: boolean) => void;
}

function CheckRow({
    checked,
    onToggle,
    linkLabel,
    onOpen,
    before,
    testID,
}: {
    checked: boolean;
    onToggle: () => void;
    linkLabel: string;
    onOpen: () => void;
    before: string;
    testID: string;
}) {
    return (
        <TouchableOpacity
            onPress={onToggle}
            style={styles.row}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            testID={testID}
        >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? <Text style={styles.tick}>✓</Text> : null}
            </View>
            <Text style={styles.text}>
                {before}{" "}
                <Text onPress={onOpen} style={styles.link}>
                    {linkLabel}
                </Text>
            </Text>
        </TouchableOpacity>
    );
}

export function LegalConsentCheckboxes({ acceptedPrivacy, acceptedTerms, onChangePrivacy, onChangeTerms }: Props) {
    const router = useRouter();
    return (
        <View style={styles.wrapper}>
            <CheckRow
                testID="register-accept-privacy"
                checked={acceptedPrivacy}
                onToggle={() => onChangePrivacy(!acceptedPrivacy)}
                before="Ho letto la"
                linkLabel="Privacy Policy"
                onOpen={() => router.push("/privacy-policy")}
            />
            <CheckRow
                testID="register-accept-terms"
                checked={acceptedTerms}
                onToggle={() => onChangeTerms(!acceptedTerms)}
                before="Accetto i"
                linkLabel="Termini e Condizioni"
                onOpen={() => router.push("/terms" as any)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { marginTop: 4, marginBottom: 16, gap: 12 },
    row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
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
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    tick: { color: "#fff", fontSize: 12, fontWeight: "900" },
    text: { flex: 1, color: "#686177", fontSize: 13, lineHeight: 20, fontWeight: "500" },
    link: { color: colors.primary, fontWeight: "800", textDecorationLine: "underline" },
});
