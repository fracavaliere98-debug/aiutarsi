import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Dimensions,
    StyleSheet,
    StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    Heart, Search, Wallet, Users, HandHeart, Building2, Plus, ChevronRight,
} from "lucide-react-native";
import { Colors } from "../constants/Colors";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
    withTiming,
    withSequence,
    withDelay,
    withRepeat,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from "react";
import { authService } from "../services/AuthService";
import { activityService } from "../services/ActivityService";
import { AppActivity } from "../types";

const { width, height } = Dimensions.get("window");

// ── Brand color palette ────────────────────────────────────────────────────
// Deep dark base + fuchsia + violet + indigo
const G = [
    { colors: ['#0d001a', '#4a0080', '#cf057f'] as const, angle: { x: 0, y: 0 } },
    { colors: ['#060025', '#6b21a8', '#e8006e'] as const, angle: { x: 1, y: 0 } },
    { colors: ['#02001f', '#312e81', '#9333ea'] as const, angle: { x: 0, y: 1 } },
];

// ── Animated mesh gradient ─────────────────────────────────────────────────
const AnimatedBackground = () => {
    const a = useSharedValue(0);
    const b = useSharedValue(0);
    const c = useSharedValue(1);

    useEffect(() => {
        // G[0]: 0→1→0 over 8s
        a.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 4000 }),
                withTiming(0, { duration: 4000 })
            ), -1, false
        );
        // G[1]: lags by 2.7s
        setTimeout(() => {
            b.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 4000 }),
                    withTiming(0, { duration: 4000 })
                ), -1, false
            );
        }, 2700);
        // G[2]: lags by 5.3s
        setTimeout(() => {
            c.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 4000 }),
                    withTiming(0, { duration: 4000 })
                ), -1, false
            );
        }, 5300);
    }, []);

    const s0 = useAnimatedStyle(() => ({ opacity: interpolate(a.value, [0, 1], [0.3, 1]) }));
    const s1 = useAnimatedStyle(() => ({ opacity: interpolate(b.value, [0, 1], [0.3, 0.85]) }));
    const s2 = useAnimatedStyle(() => ({ opacity: interpolate(c.value, [0, 1], [0.3, 0.7]) }));

    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Base dark fill */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#07000f' }]} />
            <Animated.View style={[StyleSheet.absoluteFill, s0]}>
                <LinearGradient colors={G[0].colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s1]}>
                <LinearGradient colors={G[1].colors} start={{ x: 0.8, y: 0 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, s2]}>
                <LinearGradient colors={G[2].colors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            {/* Noise-like inner highlight */}
            <LinearGradient
                colors={['rgba(207,5,127,0.12)', 'transparent', 'rgba(107,33,168,0.18)']}
                start={{ x: 0, y: 0.4 }}
                end={{ x: 1, y: 0.6 }}
                style={StyleSheet.absoluteFill}
            />
            {/* Bottom fade to near-black */}
            <LinearGradient
                colors={['transparent', 'rgba(3,0,12,0.8)']}
                start={{ x: 0.5, y: 0.3 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
};

// ── Gradient Text (per-character interpolation) ───────────────────────────
const GradientText = ({
    text, style,
    startRGB = [107, 33, 168],
    endRGB   = [207, 5, 127],
}: {
    text: string; style?: any;
    startRGB?: [number, number, number];
    endRGB?:   [number, number, number];
}) => {
    const chars = text.split('');
    const n = Math.max(chars.length - 1, 1);
    return (
        <Text style={[style, { textAlign: 'center' }]} numberOfLines={1}>
            {chars.map((char, i) => {
                const t = i / n;
                const r = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * t);
                const g = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * t);
                const b = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * t);
                return <Text key={i} style={[style, { color: `rgb(${r},${g},${b})` }]}>{char}</Text>;
            })}
        </Text>
    );
};

// ── Ticker (absolute bottom) ───────────────────────────────────────────────
const LandingTicker = ({ latestActivity }: { latestActivity: AppActivity | null }) => {
    const opacity = useSharedValue(1);

    useEffect(() => {
        const interval = setInterval(() => {
            opacity.value = withSequence(
                withTiming(0, { duration: 400 }),
                withDelay(100, withTiming(1, { duration: 400 }))
            );
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    const msg = latestActivity
        ? `Nova missione: ${latestActivity.npoName} · ${latestActivity.location.address.split(',')[0]}`
        : `Nuove opportunità di volontariato ogni giorno`;

    return (
        <Animated.View style={[styles.ticker, animStyle]}>
            <View style={styles.tickerDot} />
            <Text style={styles.tickerText} numberOfLines={1}>{msg.toUpperCase()}</Text>
        </Animated.View>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────
export default function LandingPage() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const scrollY = useSharedValue(0);
    const [latestActivity, setLatestActivity] = useState<AppActivity | null>(null);
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
            } catch (e) { console.warn(e); }
        })();
    }, []);

    const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
    const heroFade = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [0, height * 0.4], [1, 0], Extrapolation.CLAMP),
    }));
    const sectionFade = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [height * 0.3, height * 0.6], [0, 1], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.value, [height * 0.3, height * 0.6], [40, 0], Extrapolation.CLAMP) }],
    }));

    const topPad = Math.max(insets.top + 4, 48);
    const botPad = Math.max(insets.bottom + 20, 34);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ minHeight: height * 1.5 }}
            >
                {/* ── Hero ── */}
                <Animated.View style={[styles.hero, heroFade]}>
                    <AnimatedBackground />

                    {/* Overlay UI */}
                    <View style={[styles.overlay, { paddingTop: topPad }]}>

                        {/* TOP: brand logo text */}
                        <Animated.View entering={FadeInDown.duration(700).springify()} style={styles.headerWrap}>
                            <GradientText
                                text="AiutarSì"
                                style={styles.appName}
                                startRGB={[107, 33, 168]}
                                endRGB={[207, 5, 127]}
                            />
                        </Animated.View>

                        {/* CONTENT: bubble + logo circle + slogan + pill */}
                        <View style={styles.middle}>
                            {/* Bubble + logo circle (below bubble, right-aligned) */}
                            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.bubbleCol}>
                                <View style={styles.bubble}>
                                    <Text style={styles.bubbleText} numberOfLines={2}>
                                        &quot;Il tuo impegno ha un valore reale&quot;
                                    </Text>
                                    <View style={styles.bubbleTail} />
                                </View>
                                {/* Logo circle with magenta border */}
                                <View style={styles.logoBorderRing}>
                                    <View style={styles.logoInner}>
                                        <Image
                                            source={require("../assets/images/logo-transparent.png")}
                                            style={styles.logoImg}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </View>
                            </Animated.View>

                            {/* Slogan */}
                            <Animated.View entering={FadeInUp.delay(300).springify().damping(14)} style={styles.sloganWrap}>
                                <Text style={styles.sloganWhite}>
                                    Dai Valore al <Text style={styles.sloganItalic}>Tuo</Text> Tempo.
                                </Text>
                                <GradientText
                                    text="Moltiplica l'impatto."
                                    style={styles.sloganGradient}
                                    startRGB={[147, 51, 234]}
                                    endRGB={[232, 0, 110]}
                                />
                            </Animated.View>

                            {/* Social proof pill */}
                            <Animated.View entering={FadeIn.delay(500).duration(600)} style={styles.pill}>
                                <View style={styles.pillDot} />
                                <Text style={styles.pillText} numberOfLines={1}>
                                    UNISCITI A +{totalVolunteers.toLocaleString('it-IT')} PERSONE CHE STANNO GIÀ AIUTANDO.
                                </Text>
                            </Animated.View>
                        </View>

                        {/* BOTTOM: Buttons + login — ABSOLUTE at bottom */}
                        <Animated.View
                            entering={FadeInUp.delay(600).springify().damping(16)}
                            style={[styles.bottom, { bottom: botPad + 28 }]}
                        >
                            {/* Primary (magenta→violet) */}
                            <TouchableOpacity onPress={() => router.push("/register/volunteer")} activeOpacity={0.82} style={styles.primaryWrap}>
                                <LinearGradient colors={['#e8006e', '#9c27b0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill2}>
                                    <View style={styles.iconCirclePink}>
                                        <Heart size={17} color="white" fill="white" />
                                    </View>
                                    <Text style={styles.btnLabel}>Diventa Volontario</Text>
                                    <ChevronRight size={17} color="rgba(255,255,255,0.65)" />
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Secondary (indigo dark gradient) */}
                            <TouchableOpacity onPress={() => router.push("/register/npo")} activeOpacity={0.82} style={styles.secondaryWrap}>
                                <LinearGradient colors={['#1e1b4b', '#312e81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill2}>
                                    <View style={styles.iconCircleIndigo}>
                                        <Plus size={17} color="white" strokeWidth={2.5} />
                                    </View>
                                    <Text style={styles.btnLabel}>Registra il tuo Ente</Text>
                                    <ChevronRight size={17} color="rgba(255,255,255,0.5)" />
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Login */}
                            <View style={styles.loginRow}>
                                <Text style={styles.loginText}>Hai già un account? </Text>
                                <TouchableOpacity onPress={() => router.push("/login")}>
                                    <Text style={styles.loginLink}>Accedi</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>

                    {/* TICKER — absolute bottom, separate from CTA block */}
                    <LandingTicker latestActivity={latestActivity} />
                </Animated.View>

                {/* ── Come Funziona ── */}
                <Animated.View style={[styles.featureSection, sectionFade]}>
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerLabel}>Come Funziona</Text>
                        <View style={styles.dividerLine} />
                    </View>
                    <FeatureCard icon={Search} title="Scopri" description="Trova opportunità su misura per le tue abilità grazie al nostro Smart Match." color="#6366f1" delay={0} />
                    <FeatureCard icon={Heart} title="Partecipa" description="Unisciti alle attività e crea un impatto concreto nella tua comunità." color={Colors.accent} delay={150} />
                    <FeatureCard icon={Wallet} title="Ottieni Valore" description="Il tuo impegno è riconosciuto con badge che potrai condividere." color="#10b981" delay={300} />
                    <TrustIcons />
                </Animated.View>
            </Animated.ScrollView>
        </View>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────
const FeatureCard = ({ icon: Icon, title, description, color, delay }: { icon: any, title: string, description: string, color: string, delay: number }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(13)} style={styles.featureCard}>
        <View style={[styles.featureIcon, { backgroundColor: `${color}15` }]}>
            <Icon size={26} color={color} strokeWidth={2.5} />
        </View>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
    </Animated.View>
);

const TrustIcons = () => (
    <View style={styles.trustRow}>
        <Users size={20} color={Colors.text} strokeWidth={2.5} />
        <View style={styles.trustDot} />
        <HandHeart size={20} color={Colors.text} strokeWidth={2.5} />
        <View style={styles.trustDot} />
        <Building2 size={20} color={Colors.text} strokeWidth={2.5} />
    </View>
);

import { Layout, moderateScale } from "../utils/layout";

// ... existing code ...

// ── Styles ────────────────────────────────────────────────────────────────
const SLOGAN = Math.min(Layout.window.width * 0.085, 34);
const SLOGAN_GRAD = Math.min(Layout.window.width * 0.072, 28);

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#07000f' },
    hero: { width: Layout.window.width, height: Layout.window.height, overflow: 'hidden' },
    // Overlay — content groups from top, no space-between
    overlay: {
        ...StyleSheet.absoluteFillObject,
        paddingHorizontal: 22,
    },

    // Header
    headerWrap: { alignItems: 'center' },
    appName: {
        fontSize: Layout.fontSize['3xl'] + 4,
        fontWeight: '900',
        fontStyle: 'italic',
        letterSpacing: -1,
    },

    // Middle — content flows naturally from top
    middle: { gap: 18, marginTop: 42 },

    // Bubble column (right-aligned, with logo circle below)
    bubbleCol: { alignItems: 'flex-end', gap: 6 },
    bubbleRow: { alignItems: 'flex-end' },
    bubble: {
        backgroundColor: 'rgba(255,255,255,0.09)',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        maxWidth: '78%',
        alignSelf: 'flex-end',
        marginRight: 8,
    },
    bubbleText: { color: 'rgba(255,255,255,0.85)', fontSize: Layout.fontSize.xs - 1, fontWeight: '600', textAlign: 'right', lineHeight: 16 },
    bubbleTail: {
        position: 'absolute', bottom: -7, right: 16,
        width: 0, height: 0,
        borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: 'rgba(255,255,255,0.09)',
    },

    // Logo circle
    logoBorderRing: {
        width: 56, height: 56, borderRadius: 28,
        borderWidth: 2.5, borderColor: '#cf057f',
        alignSelf: 'flex-end',
        marginRight: 20,
        shadowColor: '#cf057f', shadowOpacity: 0.45, shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
    },
    logoInner: { flex: 1, borderRadius: 26, backgroundColor: '#ffffff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    logoImg: { width: '85%', height: '85%' },

    // Slogan
    sloganWrap: { alignItems: 'center', gap: 2 },
    sloganWhite: {
        color: '#ffffff',
        fontSize: SLOGAN,
        fontWeight: '900',
        lineHeight: SLOGAN * 1.18,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    sloganItalic: {
        fontStyle: 'italic',
        fontWeight: '900',
        fontSize: SLOGAN,
        color: '#ffffff',
    },
    sloganGradient: {
        fontSize: SLOGAN_GRAD,
        fontWeight: '900',
        fontStyle: 'italic',
        letterSpacing: -0.5,
        lineHeight: SLOGAN_GRAD * 1.2,
    },

    // Pill (social proof) — auto width, same visual scale as slogan line
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 100,
        paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
    pillText: { color: 'rgba(255,255,255,0.7)', fontSize: Layout.fontSize.xs - 3, fontWeight: '700', letterSpacing: 0.4, flexShrink: 1 },

    // Bottom CTA block — absolute at bottom, pushed higher
    bottom: {
        position: 'absolute',
        left: 22, right: 22,
        gap: 11,
    },
    primaryWrap: { borderRadius: 50, overflow: 'hidden' },
    secondaryWrap: {
        borderRadius: 50, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.45)',
    },
    pill2: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 18, paddingHorizontal: 22, gap: 14, borderRadius: 50,
    },
    iconCirclePink: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center', justifyContent: 'center',
    },
    iconCircleIndigo: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(99,102,241,0.3)',
        alignItems: 'center', justifyContent: 'center',
    },
    btnLabel: { flex: 1, color: '#fff', fontSize: Layout.fontSize.base - 1, fontWeight: '800', letterSpacing: -0.2 },
    loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
    loginText: { color: 'rgba(255,255,255,0.38)', fontSize: Layout.fontSize.xs - 1, fontWeight: '500' },
    loginLink: { color: 'rgba(255,255,255,0.7)', fontSize: Layout.fontSize.xs - 1, fontWeight: '800', textDecorationLine: 'underline' },

    // Ticker — absolute bottom
    ticker: {
        position: 'absolute',
        bottom: 10,
        left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 24,
    },
    tickerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cf057f', opacity: 0.8 },
    tickerText: { color: 'rgba(255,255,255,0.38)', fontSize: Layout.fontSize.xs - 3, fontWeight: '700', letterSpacing: 1.2, flexShrink: 1 },

    // Feature section
    featureSection: { paddingHorizontal: 24, paddingTop: 56, backgroundColor: '#f8fafc' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
    dividerLabel: { fontSize: Layout.fontSize.xl, fontWeight: '900', color: '#1a237e', letterSpacing: -0.5 },
    featureCard: {
        backgroundColor: '#fff', borderRadius: 32, padding: 26, marginBottom: 14,
        borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    },
    featureIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    featureTitle: { fontSize: Layout.fontSize.lg, fontWeight: '900', color: '#1a237e', marginBottom: 6, textAlign: 'center' },
    featureDesc: { fontSize: Layout.fontSize.sm - 1, color: '#64748b', lineHeight: 20, fontWeight: '500', textAlign: 'center' },
    trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 36, opacity: 0.3 },
    trustDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#94a3b8' },
});
