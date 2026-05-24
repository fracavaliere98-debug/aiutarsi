import { ReactNode } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { ScreenWrapper } from "../ScreenWrapper";
import { colors } from "@/theme";

interface AuthShellProps {
    title: string;
    subtitle: string;
    eyebrow: string;
    children: ReactNode;
    footer?: ReactNode;
    backAction: () => void;
}

export function AuthShell({
    title,
    subtitle,
    eyebrow,
    children,
    footer,
    backAction,
}: AuthShellProps) {
    return (
        <ScreenWrapper withPadding={false} className="bg-background-light">
            <View style={styles.root}>
                <View style={styles.backgroundGlowTop} />
                <View style={styles.backgroundGlowBottom} />

                <View style={styles.topBar}>
                    <TouchableOpacity onPress={backAction} style={styles.backButton} activeOpacity={0.8}>
                        <ArrowLeft size={20} color={colors.primary} />
                    </TouchableOpacity>

                    <View style={styles.brandPill}>
                        <Image
                            source={require("../../assets/images/logo-transparent.png")}
                            style={styles.brandLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.brandText}>AiutarSì</Text>
                    </View>
                </View>

                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>{eyebrow}</Text>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>

                <View style={styles.card}>{children}</View>

                {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingHorizontal: 22,
        paddingBottom: 24,
    },
    backgroundGlowTop: {
        position: "absolute",
        top: -60,
        right: -30,
        width: 180,
        height: 180,
        borderRadius: 999,
        backgroundColor: "rgba(205,5,127,0.10)",
    },
    backgroundGlowBottom: {
        position: "absolute",
        bottom: 60,
        left: -40,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: "rgba(70,34,130,0.08)",
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 10,
        marginBottom: 18,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "rgba(255,255,255,0.92)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    brandPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.82)",
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    brandLogo: {
        width: 24,
        height: 24,
    },
    brandText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "900",
    },
    hero: {
        marginBottom: 14,
    },
    eyebrow: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    title: {
        color: colors.primary,
        fontSize: 29,
        lineHeight: 33,
        fontWeight: "900",
        letterSpacing: -0.8,
        marginBottom: 8,
    },
    subtitle: {
        color: "#5f5871",
        fontSize: 14,
        lineHeight: 21,
        fontWeight: "500",
        maxWidth: "94%",
    },
    card: {
        backgroundColor: "rgba(255,255,255,0.88)",
        borderRadius: 30,
        padding: 22,
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    footer: {
        marginTop: 18,
        paddingBottom: 8,
    },
});
