import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    StatusBar,
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
import { Colors } from "../constants/Colors";
import Animated, {
    FadeInDown,
    FadeInUp,
    FadeOut,
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { authService } from "../services/AuthService";
import { activityService } from "../services/ActivityService";
import { AppActivity } from "../types";
import { Layout } from "../utils/layout";
import { GemmaAvatar } from "../components/GemmaAvatar";

const BACKGROUND_GRADIENTS = [
    ['#fff7ed', '#ffe4e6', '#fdf2f8'] as const,
    ['#fff7ed', '#ede9fe', '#eef2ff'] as const,
    ['#fef2f2', '#fae8ff', '#eff6ff'] as const,
];

const extractCityFromAddress = (address?: string | null): string | null => {
    if (!address) return null;

    const parts = address
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    const lastPart = parts[parts.length - 1] || parts[0];
    if (!lastPart) return null;

    return lastPart.replace(/\b\d{5}\b/g, "").trim() || null;
};

const MotionBackground = () => {
    const a = useSharedValue(0);
    const b = useSharedValue(0);
    const c = useSharedValue(1);

    useEffect(() => {
        a.value = withRepeat(
            withSequence(withTiming(1, { duration: 5000 }), withTiming(0, { duration: 5000 })),
            -1,
            false,
        );
        b.value = withRepeat(
            withSequence(withTiming(1, { duration: 6200 }), withTiming(0, { duration: 6200 })),
            -1,
            false,
        );
        c.value = withRepeat(
            withSequence(withTiming(1, { duration: 7600 }), withTiming(0, { duration: 7600 })),
            -1,
            false,
        );
    }, [a, b, c]);

    const s0 = useAnimatedStyle(() => ({ opacity: interpolate(a.value, [0, 1], [0.45, 1]) }));
    const s1 = useAnimatedStyle(() => ({ opacity: interpolate(b.value, [0, 1], [0.35, 0.85]) }));
    const s2 = useAnimatedStyle(() => ({ opacity: interpolate(c.value, [0, 1], [0.25, 0.7]) }));

    return (
        <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#fffaf7" }]} />
            <Animated.View style={[StyleSheet.absoluteFill, s0]}>
                <LinearGradient
                    colors={BACKGROUND_GRADIENTS[0]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s1]}>
                <LinearGradient
                    colors={BACKGROUND_GRADIENTS[1]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s2]}>
                <LinearGradient
                    colors={BACKGROUND_GRADIENTS[2]}
                    start={{ x: 0.25, y: 0 }}
                    end={{ x: 0.75, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            <View style={styles.blobOne} />
            <View style={styles.blobTwo} />
        </View>
    );
};

const HeroStat = ({ value, label }: { value: string; label: string }) => (
    <View style={styles.heroStat}>
        <Text style={styles.heroStatValue}>{value}</Text>
        <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
);

const RoleCard = ({
    title,
    description,
    eyebrow,
    icon,
    colors,
    highlight,
    onPress,
}: {
    title: string;
    description: string;
    eyebrow: string;
    icon: React.ReactNode;
    colors: readonly [string, string];
    highlight?: string;
    onPress: () => void;
}) => (
    <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPress}
        style={styles.roleCardShadow}
    >
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.roleCard}>
            <View style={styles.roleCardTop}>
                <View style={styles.roleIconWrap}>{icon}</View>
                <Text style={styles.roleEyebrow}>{eyebrow}</Text>
            </View>
            {highlight ? (
                <View style={styles.roleHighlightBadge}>
                    <Text style={styles.roleHighlightText}>{highlight}</Text>
                </View>
            ) : null}
            <Text style={styles.roleTitle}>{title}</Text>
            <Text style={styles.roleDescription}>{description}</Text>
            <View style={styles.roleFooter}>
                <Text style={styles.roleCta}>Inizia ora</Text>
                <ArrowRight size={18} color="#fff" />
            </View>
        </LinearGradient>
    </TouchableOpacity>
);

const FeatureCard = ({
    icon,
    title,
    text,
    accent,
    delay,
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
    accent: string;
    delay: number;
}) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(520)} style={styles.featureCard}>
        <View style={[styles.featureIconWrap, { backgroundColor: `${accent}14` }]}>
            {icon}
        </View>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
    </Animated.View>
);

export default function LandingPage() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const scrollY = useSharedValue(0);
    const [latestActivity, setLatestActivity] = useState<AppActivity | null>(null);
    const [latestCities, setLatestCities] = useState<string[]>([]);
    const [cityIndex, setCityIndex] = useState(0);
    const [totalVolunteers, setTotalVolunteers] = useState(1);

    useEffect(() => {
        (async () => {
            try {
                const [count, activity] = await Promise.all([
                    authService.getTotalVolunteersCount(),
                    activityService.getLatestActivity(),
                ]);
                setTotalVolunteers(count || 1);
                setLatestActivity(activity);

                const recentActivities = await activityService.getLatestActivities(10);
                const cities = recentActivities
                    .map((item) => extractCityFromAddress(item.location?.address))
                    .filter((city, index, arr): city is string => Boolean(city) && arr.indexOf(city) === index)
                    .slice(0, 10);

                setLatestCities(cities);
            } catch (e) {
                console.warn(e);
            }
        })();
    }, []);

    useEffect(() => {
        if (latestCities.length <= 1) return;

        const interval = setInterval(() => {
            setCityIndex((current) => (current + 1) % latestCities.length);
        }, 2200);

        return () => clearInterval(interval);
    }, [latestCities]);

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    const heroStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: interpolate(scrollY.value, [0, 260], [0, -26], Extrapolation.CLAMP),
            },
        ],
        opacity: interpolate(scrollY.value, [0, 260], [1, 0.78], Extrapolation.CLAMP),
    }));

    const latestCity = useMemo(() => {
        return latestCities[cityIndex] || extractCityFromAddress(latestActivity?.location?.address) || "vicino a te";
    }, [cityIndex, latestActivity?.location?.address, latestCities]);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <MotionBackground />

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingTop: insets.top + 18,
                    paddingBottom: insets.bottom + 42,
                }}
            >
                <Animated.View style={[styles.page, heroStyle]}>
                    <Animated.View entering={FadeInDown.duration(550)} style={styles.brandRow}>
                        <View style={styles.brandPill}>
                            <Image
                                source={require("../assets/images/logo-transparent.png")}
                                style={styles.brandLogo}
                                resizeMode="contain"
                            />
                            <Text style={styles.brandPillText}>AiutarSì</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => router.push("/login")} 
                            activeOpacity={0.75}
                            testID="btn-landing-login"
                        >
                            <Text style={styles.loginLinkTop}>Accedi</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(120).duration(620)} style={styles.heroBlock}>
                        <Text style={styles.heroHeadline}>
                            Il volontariato che entra davvero nella tua giornata.
                        </Text>
                        <Text style={styles.heroSubheadline}>
                            Scopri opportunità vicine e scegli come iniziare in pochi minuti.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(240).duration(620)} style={styles.heroStatsRow}>
                        <HeroStat value={`+${totalVolunteers.toLocaleString("it-IT")}`} label="Volontari attivi" />
                        <HeroStat value={latestActivity ? "Live" : "Nuove"} label="Opportunità ogni giorno" />
                        <HeroStat value="AI" label="Smart Match guidato" />
                    </Animated.View>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(300).duration(620)} style={styles.registrationBlock}>
                    <View style={styles.registrationHeader}>
                        <Text style={styles.roleIntroEyebrow}>Scegli come entrare in AiutarSì</Text>
                        <Text style={styles.registrationTitle}>Il percorso giusto, subito.</Text>
                        <Text style={styles.registrationText}>
                            Seleziona il tuo profilo e continua con un’iscrizione pensata per quello che vuoi fare.
                        </Text>
                        <View style={styles.gemmaBadge}>
                            <GemmaAvatar size={20} />
                            <Text style={styles.gemmaBadgeText}>Onboarding guidato da Gemma</Text>
                        </View>
                    </View>

                    <View style={styles.ctaStack}>
                        <RoleCard
                            title="Diventa volontario"
                            eyebrow="Per iniziare subito"
                            description="Trova attività compatibili con interessi, zona e tempo disponibile."
                            colors={["#462282", "#cd057f"]}
                            icon={<HeartHandshake size={22} color="#fff" />}
                            onPress={() => router.push("/register/volunteer")}
                        />
                        <RoleCard
                            title="Registra il tuo ente"
                            eyebrow="Per associazioni e NPO"
                            description="Pubblica iniziative, ricevi candidature e coordina la tua community."
                            colors={["#1f2a44", "#334155"]}
                            icon={<Building2 size={22} color="#fff" />}
                            onPress={() => router.push("/register/npo")}
                        />
                    </View>
                </Animated.View>

                <View style={styles.conversionStrip}>
                    <View style={styles.conversionPill}>
                        <MapPin size={15} color={Colors.primary} />
                        <View style={styles.conversionPillTextRow}>
                            <Text style={styles.conversionPillText}>Ultime opportunità pubblicate a </Text>
                            <Animated.Text
                                key={latestCity}
                                entering={FadeInUp.duration(240)}
                                exiting={FadeOut.duration(200)}
                                style={styles.conversionPillStrong}
                            >
                                {latestCity}
                            </Animated.Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Animated.View entering={FadeInDown.delay(100).duration(520)} style={styles.sectionHeader}>
                        <Text style={styles.sectionEyebrow}>Perché funziona</Text>
                        <Text style={styles.sectionTitle}>Più chiaro, meno dispersione.</Text>
                        <Text style={styles.sectionSubtitle}>
                            Capisci subito dove iniziare, quali opportunità fanno per te e come entrare in contatto con enti affidabili.
                        </Text>
                    </Animated.View>

                    <FeatureCard
                        delay={120}
                        accent={Colors.primary}
                        icon={<MapPin size={22} color={Colors.primary} />}
                        title="Scopri attività vicine"
                        text="Le opportunità vengono presentate in modo semplice, con contesto territoriale e priorità leggibili."
                    />
                    <FeatureCard
                        delay={220}
                        accent={Colors.accent}
                        icon={<CalendarClock size={22} color={Colors.accent} />}
                        title="Scegli in base al tuo tempo"
                        text="Non serve stravolgere la giornata: puoi trovare occasioni brevi, urgenti o ricorrenti."
                    />
                    <FeatureCard
                        delay={320}
                        accent={"#0f766e"}
                        icon={<ShieldCheck size={22} color="#0f766e" />}
                        title="Aiuta enti reali"
                        text="L’esperienza è costruita per ridurre il rumore e far emergere organizzazioni e richieste concrete."
                    />
                </View>

                <View style={styles.statementPanel}>
                    <Text style={styles.statementQuote}>
                        “Non ti chiediamo di cambiare vita. Ti chiediamo di dare più valore al tempo che hai già.”
                    </Text>
                    <View style={styles.statementTrustRow}>
                        <Users size={18} color={Colors.secondary} />
                        <View style={styles.statementDot} />
                        <HeartHandshake size={18} color={Colors.secondary} />
                        <View style={styles.statementDot} />
                        <Building2 size={18} color={Colors.secondary} />
                    </View>
                </View>

                <View style={styles.bottomCtaWrap}>
                    <View style={styles.bottomLoginRow}>
                        <Text style={styles.bottomLoginText}>Hai già un account? </Text>
                        <TouchableOpacity onPress={() => router.push("/login")} activeOpacity={0.75}>
                            <Text style={styles.bottomLoginLink}>Accedi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#fffaf7",
    },
    page: {
        paddingHorizontal: 22,
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    brandPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(255,255,255,0.78)",
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    brandLogo: {
        width: 28,
        height: 28,
    },
    brandPillText: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: "900",
        letterSpacing: 0.2,
    },
    loginLinkTop: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: "800",
    },
    heroBlock: {
        marginBottom: 18,
    },
    heroHeadline: {
        color: Colors.primary,
        fontSize: Math.min(Layout.window.width * 0.094, 37),
        lineHeight: Math.min(Layout.window.width * 0.102, 41),
        fontWeight: "900",
        letterSpacing: -0.9,
        marginBottom: 12,
    },
    heroSubheadline: {
        color: "#5b556b",
        fontSize: 15,
        lineHeight: 22,
        fontWeight: "500",
        maxWidth: "88%",
    },
    liveNotice: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(255,255,255,0.72)",
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignSelf: "flex-start",
        marginBottom: 18,
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    liveNoticeText: {
        color: Colors.secondary,
        fontSize: 13,
        fontWeight: "600",
    },
    liveNoticeStrong: {
        color: Colors.primary,
        fontWeight: "900",
    },
    heroStatsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 20,
    },
    heroStat: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    heroStatValue: {
        color: "#37245f",
        fontSize: 19,
        fontWeight: "900",
        marginBottom: 4,
    },
    heroStatLabel: {
        color: "#6b647a",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
    ctaStack: {
        gap: 14,
    },
    roleIntroEyebrow: {
        color: Colors.accent,
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1.1,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    roleIntroText: {
        color: "#6b647a",
        fontSize: 14,
        lineHeight: 21,
        fontWeight: "600",
    },
    registrationBlock: {
        marginTop: 0,
        marginHorizontal: 22,
        padding: 22,
        borderRadius: 30,
        backgroundColor: "rgba(255,255,255,0.72)",
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
    },
    registrationHeader: {
        marginBottom: 18,
    },
    registrationTitle: {
        color: Colors.primary,
        fontSize: 23,
        lineHeight: 27,
        fontWeight: "900",
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    registrationText: {
        color: "#6b647a",
        fontSize: 14,
        lineHeight: 21,
        fontWeight: "600",
    },
    gemmaBadge: {
        marginTop: 12,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(205,5,127,0.08)",
        borderWidth: 1,
        borderColor: "rgba(205,5,127,0.10)",
    },
    gemmaBadgeText: {
        color: Colors.accent,
        fontSize: 12,
        fontWeight: "800",
    },
    roleCardShadow: {
        borderRadius: 30,
        shadowColor: "#150c2a",
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
    },
    roleCard: {
        borderRadius: 30,
        padding: 22,
        minHeight: 178,
    },
    roleCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },
    roleIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
    },
    roleEyebrow: {
        color: "rgba(255,255,255,0.78)",
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    roleTitle: {
        color: "#fff",
        fontSize: 24,
        lineHeight: 28,
        fontWeight: "900",
        marginBottom: 10,
    },
    roleHighlightBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.18)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        marginBottom: 12,
    },
    roleHighlightText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 0.4,
    },
    roleDescription: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 14,
        lineHeight: 21,
        fontWeight: "500",
    },
    roleFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 18,
    },
    roleCta: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "900",
    },
    section: {
        paddingHorizontal: 22,
        paddingTop: 36,
    },
    conversionStrip: {
        paddingHorizontal: 22,
        paddingTop: 24,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    conversionPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.76)",
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.06)",
    },
    conversionPillTextRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
    },
    conversionPillText: {
        color: "#4f4861",
        fontSize: 13,
        fontWeight: "700",
    },
    conversionPillStrong: {
        color: Colors.accent,
        fontSize: 13,
        fontWeight: "900",
    },
    sectionHeader: {
        marginBottom: 18,
    },
    sectionEyebrow: {
        color: Colors.accent,
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    sectionTitle: {
        color: Colors.primary,
        fontSize: 25,
        lineHeight: 29,
        fontWeight: "900",
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    sectionSubtitle: {
        color: "#6b647a",
        fontSize: 15,
        lineHeight: 23,
        fontWeight: "500",
    },
    featureCard: {
        backgroundColor: "rgba(255,255,255,0.9)",
        borderRadius: 26,
        padding: 22,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.06)",
    },
    featureIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },
    featureTitle: {
        color: "#37245f",
        fontSize: 19,
        fontWeight: "900",
        marginBottom: 8,
    },
    featureText: {
        color: "#625b72",
        fontSize: 14,
        lineHeight: 21,
        fontWeight: "500",
    },
    statementPanel: {
        marginHorizontal: 22,
        marginTop: 18,
        borderRadius: 28,
        paddingHorizontal: 22,
        paddingVertical: 24,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.06)",
    },
    statementQuote: {
        color: Colors.primary,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: "800",
        letterSpacing: -0.4,
        textAlign: "center",
    },
    statementTrustRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        marginTop: 18,
    },
    statementDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#c7c2d3",
    },
    bottomCtaWrap: {
        paddingHorizontal: 22,
        paddingTop: 24,
        gap: 14,
    },
    bottomLoginRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    bottomLoginText: {
        color: "#726b80",
        fontSize: 13,
        fontWeight: "500",
    },
    bottomLoginLink: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: "900",
    },
    blobOne: {
        position: "absolute",
        top: 80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: "rgba(205,5,127,0.11)",
    },
    blobTwo: {
        position: "absolute",
        bottom: 140,
        left: -70,
        width: 250,
        height: 250,
        borderRadius: 999,
        backgroundColor: "rgba(70,34,130,0.08)",
    },
});
