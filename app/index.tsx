import {
    View,
    Text,
    TouchableOpacity,
    Image,
    ScrollView,
    StyleSheet,
    StatusBar,
    AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    ArrowRight,
    Building2,
    CalendarClock,
    HeartHandshake,
    MapPin,
    ShieldCheck,
    Users,
} from "lucide-react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useEffect, useState } from "react";
import { authService } from "../services/AuthService";
import { colors, radius, spacing, fontSize, fontWeight, shadows, typography, withAlpha } from "@/theme";
import { SectionHeader } from "../components/ui";

// NOTE (design-system, eccezione temporanea documentata — vedi docs/design-system.md
// "Temporary exceptions must be marked and removed during the related migration slice"):
// il primo schermo usa un blocco di colore pieno (colors.primary, NIENTE gradiente) con
// angoli arrotondati solo in basso, lo stesso linguaggio della barra colorata di
// components/StandardLayout.tsx usata in ogni schermata post-login — così la landing
// "si aggancia" visivamente al resto dell'app invece di introdurre un concetto a parte.
// Niente blob/glow decorativi: un solo blocco di colore netto (color-blocking), coerente
// con la direzione "no gradienti/chrome decorativo, un solo colore per gli elementi
// interattivi" adottata dopo il confronto con le linee guida Apple. I toni qui sotto sono
// derivati SOLO da colors.white/colors.primary/colors.accent esistenti tramite withAlpha()
// (theme/withAlpha.ts, condiviso — non una copia locale).

// Testo bianco su colors.primary (#462282): anche la variante più trasparente qui sotto
// (78%) resta a ~7.6:1 di contrasto — ben sopra la soglia AA 4.5:1 — verificato via calcolo
// WCAG (luminanza relativa + alpha blend) prima di scegliere i valori, non a occhio.
const surfaceTint = {
    ctaIconBg: withAlpha(colors.white, 0.2),
    onBandMuted: withAlpha(colors.white, 0.9),
    onBandSubtle: withAlpha(colors.white, 0.82),
    onBandFaint: withAlpha(colors.white, 0.78),
};

// Area toccabile minima raccomandata da WCAG 2.5.5 per i link solo-testo, che qui non
// hanno un box/sfondo visibile: allarghiamo l'area di tap senza toccare il layout visivo.
const linkHitSlop = { top: 14, bottom: 14, left: 14, right: 14 };

const PrimaryButton = ({
    title,
    icon,
    onPress,
    testID,
}: {
    title: string;
    icon: (color: string) => React.ReactNode;
    onPress: () => void;
    testID?: string;
}) => (
    <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={styles.ctaShadow}
        accessibilityRole="button"
        accessibilityLabel={title}
        testID={testID}
    >
        <View style={styles.cta}>
            <View style={styles.ctaIcon}>{icon(colors.white)}</View>
            <Text style={styles.ctaTitle}>{title}</Text>
            <View style={styles.ctaArrow}>
                <ArrowRight size={18} color={colors.accent} />
            </View>
        </View>
    </TouchableOpacity>
);

const FeatureRow = ({
    icon,
    iconBg,
    title,
    text,
    delay,
    reduceMotion,
    showDivider,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    text: string;
    delay: number;
    reduceMotion: boolean;
    showDivider: boolean;
}) => (
    <>
        <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.delay(delay).duration(420)}
            style={styles.featureRow}
        >
            <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>{icon}</View>
            <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureText}>{text}</Text>
            </View>
        </Animated.View>
        {showDivider ? <View style={styles.featureDivider} /> : null}
    </>
);

export default function LandingPage() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [totalVolunteers, setTotalVolunteers] = useState(1);
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        let isMounted = true;
        AccessibilityInfo.isReduceMotionEnabled?.()
            .then((enabled) => {
                if (isMounted) setReduceMotion(Boolean(enabled));
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const count = await authService.getTotalVolunteersCount();
                setTotalVolunteers(count || 1);
            } catch (e) {
                console.warn(e);
            }
        })();
    }, []);

    const fadeInDown = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(420));
    const fadeInUp = (delay: number) => (reduceMotion ? undefined : FadeInUp.delay(delay).duration(480));

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing["4xl"] }}
            >
                <View style={[styles.heroBand, { paddingTop: insets.top + spacing.lg }]}>
                    <Animated.View entering={fadeInDown(0)} style={styles.topBar}>
                        <View style={styles.brandPill}>
                            <Image
                                source={require("../assets/images/logo-transparent.png")}
                                style={styles.brandLogo}
                                resizeMode="contain"
                                accessible={false}
                            />
                            <Text style={styles.brandText}>AiutarSì</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push("/login")}
                            activeOpacity={0.7}
                            testID="btn-landing-login"
                            accessibilityRole="button"
                            accessibilityLabel="Accedi al tuo account"
                            hitSlop={linkHitSlop}
                        >
                            <Text style={styles.loginLink}>Accedi</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={fadeInUp(60)} style={styles.hero}>
                        <Text style={styles.eyebrow}>Volontariato vicino a te</Text>
                        <Text style={styles.headline}>Trova un modo per aiutare, vicino a te.</Text>
                        <Text style={styles.subtitle}>Attività vere, in pochi minuti, senza esperienza.</Text>
                    </Animated.View>

                    <Animated.View entering={fadeInUp(120)} style={styles.heroCta}>
                        <PrimaryButton
                            title="Diventa volontario"
                            icon={(color) => <HeartHandshake size={22} color={color} />}
                            onPress={() => router.push("/register/volunteer")}
                            testID="btn-landing-cta-volunteer"
                        />
                        <TouchableOpacity
                            onPress={() => router.push("/register/npo")}
                            activeOpacity={0.7}
                            style={styles.npoLinkOnBand}
                            accessibilityRole="button"
                            accessibilityLabel="Rappresenti un ente? Registrati come organizzazione non profit"
                            hitSlop={linkHitSlop}
                        >
                            <Text style={styles.npoLinkOnBandText}>
                                Rappresenti un ente? <Text style={styles.npoLinkOnBandStrong}>Registrati</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                <View style={styles.contentSection}>
                    <Animated.View entering={fadeInUp(160)} style={styles.trustRow}>
                        <Users size={14} color={colors.textSecondary} />
                        <Text style={styles.trustText}>
                            <Text style={styles.trustNumber}>+{totalVolunteers.toLocaleString("it-IT")}</Text>{" "}
                            volontari attivi
                        </Text>
                    </Animated.View>

                    <Animated.View entering={fadeInDown(80)}>
                        <SectionHeader
                            eyebrow="Perché funziona"
                            title="Chiaro fin dall'inizio."
                            style={{ marginTop: spacing["3xl"], marginBottom: spacing.sm }}
                        />
                    </Animated.View>

                    <FeatureRow
                        delay={120}
                        reduceMotion={reduceMotion}
                        showDivider
                        iconBg={colors.successSoft}
                        icon={<ShieldCheck size={20} color={colors.successStrong} />}
                        title="Enti verificati"
                        text="Ogni organizzazione è controllata prima di poter pubblicare."
                    />
                    <FeatureRow
                        delay={180}
                        reduceMotion={reduceMotion}
                        showDivider
                        iconBg={colors.primarySoft}
                        icon={<MapPin size={20} color={colors.primary} />}
                        title="Tutto chiaro subito"
                        text="Vedi dove, quando e per quanto tempo."
                    />
                    <FeatureRow
                        delay={240}
                        reduceMotion={reduceMotion}
                        showDivider={false}
                        iconBg={colors.accentSoft}
                        icon={<CalendarClock size={20} color={colors.accent} />}
                        title="Il tempo che hai"
                        text="Un'ora o un weekend: scegli tu."
                    />

                    <View style={styles.closing}>
                        <Text style={styles.closingEyebrow}>Pronto?</Text>
                        <Text style={styles.closingTitle}>Inizia in due minuti.</Text>

                        <PrimaryButton
                            title="Diventa volontario"
                            icon={(color) => <HeartHandshake size={22} color={color} />}
                            onPress={() => router.push("/register/volunteer")}
                            testID="btn-landing-cta-volunteer-bottom"
                        />

                        <TouchableOpacity
                            onPress={() => router.push("/register/npo")}
                            activeOpacity={0.7}
                            style={styles.closingNpoLink}
                            accessibilityRole="button"
                            accessibilityLabel="Rappresenti un ente? Registrati come organizzazione non profit"
                            hitSlop={linkHitSlop}
                        >
                            <Building2 size={14} color={colors.primary} />
                            <Text style={styles.closingNpoLinkText}>Rappresenti un ente? Registrati</Text>
                        </TouchableOpacity>

                        <View style={styles.bottomLoginRow}>
                            <Text style={styles.bottomLoginText}>Hai già un account? </Text>
                            <TouchableOpacity
                                onPress={() => router.push("/login")}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Accedi al tuo account"
                                hitSlop={linkHitSlop}
                            >
                                <Text style={styles.bottomLoginLink}>Accedi</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    heroBand: {
        backgroundColor: colors.primary,
        borderBottomLeftRadius: radius.panel,
        borderBottomRightRadius: radius.panel,
        paddingHorizontal: spacing["2xl"],
        paddingBottom: spacing["3xl"],
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing["2xl"],
    },
    brandPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.white,
    },
    brandLogo: {
        width: 24,
        height: 24,
    },
    brandText: {
        color: colors.primary,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.black,
    },
    loginLink: {
        color: colors.white,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.extrabold,
    },
    hero: {
        marginBottom: spacing["2xl"],
    },
    eyebrow: {
        color: surfaceTint.onBandMuted,
        fontSize: fontSize.label,
        fontWeight: fontWeight.black,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: spacing.sm,
    },
    headline: {
        ...typography.hero,
        color: colors.white,
        letterSpacing: -0.6,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: surfaceTint.onBandSubtle,
        maxWidth: "94%",
    },
    heroCta: {
        alignItems: "stretch",
    },
    ctaShadow: {
        borderRadius: radius.pill,
        ...shadows.card(),
    },
    cta: {
        backgroundColor: colors.accent,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing["2xl"],
    },
    ctaIcon: {
        width: 44,
        height: 44,
        borderRadius: radius.circle,
        backgroundColor: surfaceTint.ctaIconBg,
        alignItems: "center",
        justifyContent: "center",
    },
    ctaTitle: {
        flex: 1,
        color: colors.white,
        fontSize: fontSize.titleLarge,
        fontWeight: fontWeight.black,
    },
    ctaArrow: {
        width: 40,
        height: 40,
        borderRadius: radius.circle,
        backgroundColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
    },
    npoLinkOnBand: {
        alignItems: "center",
        marginTop: spacing.lg,
        paddingVertical: spacing.xs,
    },
    npoLinkOnBandText: {
        color: surfaceTint.onBandFaint,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.medium,
    },
    npoLinkOnBandStrong: {
        color: colors.white,
        fontWeight: fontWeight.black,
        textDecorationLine: "underline",
    },
    contentSection: {
        paddingHorizontal: spacing["2xl"],
        paddingTop: spacing["2xl"],
    },
    trustRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing["2xs"],
    },
    trustText: {
        color: colors.textSecondary,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.medium,
    },
    trustNumber: {
        color: colors.primary,
        fontWeight: fontWeight.black,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        paddingVertical: spacing.md,
    },
    featureDivider: {
        height: 1,
        backgroundColor: colors.borderMuted,
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
    },
    featureTextCol: {
        flex: 1,
    },
    featureTitle: {
        color: colors.text,
        fontSize: fontSize.body,
        fontWeight: fontWeight.black,
        marginBottom: spacing["2xs"],
    },
    featureText: {
        color: colors.textSecondary,
        fontSize: fontSize.bodySmall,
        lineHeight: 18,
        fontWeight: fontWeight.medium,
    },
    closing: {
        marginTop: spacing["3xl"],
        paddingTop: spacing["2xl"],
        borderTopWidth: 1,
        borderTopColor: colors.borderMuted,
    },
    closingEyebrow: {
        color: colors.accent,
        fontSize: fontSize.label,
        fontWeight: fontWeight.black,
        letterSpacing: 1,
        textTransform: "uppercase",
        textAlign: "center",
        marginBottom: spacing["2xs"],
    },
    closingTitle: {
        color: colors.primary,
        fontSize: fontSize.titleLarge,
        fontWeight: fontWeight.black,
        textAlign: "center",
        marginBottom: spacing.lg,
    },
    closingNpoLink: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing["2xs"],
        marginTop: spacing.lg,
        paddingVertical: spacing.xs,
    },
    closingNpoLinkText: {
        color: colors.primary,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.black,
        textDecorationLine: "underline",
    },
    bottomLoginRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: spacing.xl,
    },
    bottomLoginText: {
        color: colors.textSecondary,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.medium,
    },
    bottomLoginLink: {
        color: colors.primary,
        fontSize: fontSize.bodySmall,
        fontWeight: fontWeight.black,
        textDecorationLine: "underline",
    },
});
