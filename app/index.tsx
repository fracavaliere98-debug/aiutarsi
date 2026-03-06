import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenWrapper } from "../components/ScreenWrapper";
import { ArrowRight, Heart, Search, Wallet, Zap, CheckCircle, Users, HandHeart, Building2 } from "lucide-react-native";
import { Colors } from "../constants/Colors";
import Animated, { FadeInDown, FadeInUp, useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation } from "react-native-reanimated";

const { width } = Dimensions.get("window");

export default function LandingPage() {
    const router = useRouter();
    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    // Sticky CTA Animation
    const stickyCtaStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        scrollY.value,
                        [0, 100],
                        [100, 0], // Slide up when scrolling starts? Or just always visible? 
                        // OldUser said "persistent at the bottom", usually implies always there or appears after hero.
                        // Let's make it appear after a short scroll to avoid cluttering the hero initially if that's preferred,
                        // BUT "sticky... facilitates conversion DURING scrolling". 
                        // Let's make it visible after the main hero CTA scrolls out (approx 300px).
                        Extrapolation.CLAMP
                    ),
                },
            ],
            opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
        };
    });

    const FeatureCard = ({ icon: Icon, title, description, color, delay }: { icon: any, title: string, description: string, color: string, delay: number }) => (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(12)}
            className="bg-white p-8 rounded-[40px] shadow-sm mb-6 border border-gray-50 items-center text-center"
        >
            <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-6`} style={{ backgroundColor: `${color}15` }}>
                <Icon size={32} color={color} strokeWidth={2.5} />
            </View>
            <Text className="text-2xl font-black text-[#1a237e] mb-3 text-center">{title}</Text>
            <Text className="text-slate-500 text-base leading-6 font-medium text-center px-4">{description}</Text>
        </Animated.View>
    );

    return (
        <ScreenWrapper withPadding={false} bg="bg-[#f8fafc]" edges={['top', 'left', 'right']}>
            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }} // Space for sticky CTA
            >
                {/* Navbar */}
                <View className="pl-0 pr-6 pt-6 pb-2 flex-row justify-between items-center">
                    <Image
                        source={require("../assets/images/logo-transparent.png")}
                        className="w-56 h-16 -ml-12"
                        resizeMode="contain"
                    />
                    <TouchableOpacity
                        onPress={() => router.push("/login")}
                        className="bg-white px-6 py-2.5 rounded-full shadow-sm border border-gray-100 active:scale-95"
                    >
                        <Text className="text-primary font-bold text-sm">Accedi</Text>
                    </TouchableOpacity>
                </View>

                {/* Hero Section */}
                <View className="px-4 mb-12">
                    <Animated.View
                        entering={FadeInUp.springify().damping(15)}
                        className="w-full aspect-[4/4] rounded-[48px] overflow-hidden shadow-2xl bg-gray-200 relative"
                    >
                        <Image
                            source={{ uri: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?q=80&w=2074&auto=format&fit=crop" }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />

                        {/* Floating Badge */}
                        <Animated.View
                            entering={FadeInDown.delay(300).springify()}
                            className="absolute bottom-6 right-6 bg-white p-0 rounded-full flex-row items-center justify-center gap-2 shadow-lg shadow-black/10"
                        >
                            <Heart size={18} color={Colors.accent} fill={Colors.accent} />
                            <Text className="text-primary font-bold text-sm leading-tight">Impatto Reale</Text>
                        </Animated.View>
                    </Animated.View>

                    <View className="mt-8 px-2">
                        <Animated.Text
                            entering={FadeInDown.delay(100).springify()}
                            className="text-4xl font-black text-[#1a237e] text-center leading-[1.1] mb-4"
                        >
                            Il tuo impegno ha un <Text style={{ color: Colors.accent }}>valore reale.</Text>
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeInDown.delay(200).springify()}
                            className="text-secondary/70 text-center text-lg leading-7 px-4"
                        >
                            Unisciti alla community, aiuta le NPO e ottieni riconoscimenti per il tuo impatto.
                        </Animated.Text>
                    </View>
                </View>

                {/* Come Funziona Sections */}
                <View className="px-6 gap-2">
                    <View className="flex-row items-center justify-center gap-4 mb-8">
                        <View className="h-[1px] bg-slate-200 flex-1" />
                        <Text className="text-2xl font-black text-[#1a237e] tracking-tight">Come Funziona</Text>
                        <View className="h-[1px] bg-slate-200 flex-1" />
                    </View>

                    <FeatureCard
                        icon={Search}
                        title="Scopri"
                        description="Trova opportunità di volontariato su misura per le tue abilità grazie al nostro Smart Match."
                        color="#6366f1"
                        delay={0}
                    />

                    <FeatureCard
                        icon={Heart}
                        title="Partecipa"
                        description="Unisciti alle attività e crea un impatto concreto nella tua comunità locale."
                        color={Colors.accent}
                        delay={200}
                    />

                    <FeatureCard
                        icon={Wallet}
                        title="Ottieni Valore"
                        description="Il tuo impegno e le tue ore sono riconosciute con badge che potrai condividere con i tuoi amici"
                        color="#10b981"
                        delay={400}
                    />
                </View>

                {/* Trust Icons Section */}
                <View className="items-center justify-center py-8 opacity-40">
                    <View className="flex-row items-center gap-6">
                        <View className="items-center justify-center">
                            <Users size={24} color={Colors.text} strokeWidth={2.5} />
                        </View>
                        <View className="w-1 h-1 rounded-full bg-gray-400" />
                        <View className="items-center justify-center">
                            <HandHeart size={24} color={Colors.text} strokeWidth={2.5} />
                        </View>
                        <View className="w-1 h-1 rounded-full bg-gray-400" />
                        <View className="items-center justify-center">
                            <Building2 size={24} color={Colors.text} strokeWidth={2.5} />
                        </View>
                    </View>
                </View>

                {/* Padding at bottom to ensure content isn't hidden behind sticky CTA */}
                <View className="h-14" />

            </Animated.ScrollView>

            {/* Sticky CTA - Solid Background for readability */}
            <Animated.View
                style={[
                    stickyCtaStyle,
                    {
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'white', // Solid background
                        padding: 24,
                        paddingTop: 24,
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                        shadowColor: "#000",
                        shadowOffset: {
                            width: 0,
                            height: -4,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 10,
                    }
                ]}
            >
                <TouchableOpacity
                    onPress={() => router.push("/register/volunteer")}
                    className="w-full py-4 rounded-full flex-row justify-center items-center gap-2 active:scale-95 shadow-lg"
                    style={{ backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOpacity: 0.3 }}
                >
                    <Text className="text-white text-lg font-bold">Inizia Ora</Text>
                    <ArrowRight size={20} color="white" strokeWidth={2.5} />
                </TouchableOpacity>
                <View className="flex-row justify-center mt-4">
                    <Text className="text-slate-500 font-medium">Hai già un account? </Text>
                    <TouchableOpacity onPress={() => router.push("/login")}>
                        <Text className="text-[#1a237e] font-black">Accedi</Text>
                    </TouchableOpacity>
                </View>

                {/* Debug / Reset Button (Hidden-ish) */}
                <TouchableOpacity
                    onPress={async () => {
                        try {
                            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                            await AsyncStorage.clear();
                            alert("App Data Reset! Please restart the app.");
                        } catch (e) {
                            alert("Reset failed: " + e);
                        }
                    }}
                    style={{ opacity: 0.1, marginTop: 20, alignItems: 'center' }}
                >
                    <Text className="text-xs">Reset All Data</Text>
                </TouchableOpacity>

            </Animated.View>
        </ScreenWrapper>
    );
}
