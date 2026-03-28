import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Switch, Animated, ScrollView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Bell, Shield, Rocket, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserAvatar } from '../../components/UserAvatar';
import { GemmaAvatar } from '../../components/GemmaAvatar';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { requestForegroundLocationPermission, requestNotificationPermission } from '../../utils/permissions';
import { BrandedLoadingVideo } from '../../components/BrandedLoadingVideo';

const onboardingLoadingVideo = require('../../assets/videos/hailuo-2_3_bright_lens_flare_Create_a_premium_mobile_app_opening_animation_for_a_brand_call-0.mp4');

export default function WelcomeScreen() {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();
    const [phase, setPhase] = useState<'permissions' | 'transition'>('permissions');
    
    // Phase 1 States
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    
    // Phase 2 States
    const progress = useRef(new Animated.Value(0)).current;
    const [progressPercent, setProgressPercent] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const videoFadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (phase === 'transition') {
            fadeAnim.setValue(0);
            progress.setValue(0);
            videoFadeAnim.setValue(1);

            // Fade in transition
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }).start();

            // Progress bar animation (5 seconds)
            Animated.timing(progress, {
                toValue: 1,
                duration: 3400,
                useNativeDriver: false,
            }).start();

            const listener = progress.addListener(({ value }) => {
                setProgressPercent(Math.floor(value * 100));
            });

            const fadeOutTimer = setTimeout(() => {
                Animated.timing(videoFadeAnim, {
                    toValue: 0,
                    duration: 700,
                    useNativeDriver: true,
                }).start();
            }, 3300);

            const timer = setTimeout(async () => {
                await updateUserProfile({ profile_completed: true });
                if (user?.role === "NPO") {
                    router.replace("/(npo)/(tabs)/community" as any);
                } else {
                    router.replace("/(volunteer)/(tabs)/community" as any);
                }
            }, 4000);

            return () => {
                progress.removeListener(listener);
                clearTimeout(fadeOutTimer);
                clearTimeout(timer);
            };
        }
    }, [fadeAnim, phase, progress, router, updateUserProfile, user?.role, videoFadeAnim]);

    const toggleLocation = async (value: boolean) => {
        if (value) {
            const granted = await requestForegroundLocationPermission({
                title: 'Accesso alla posizione',
                message: 'AiutarSi usa la tua posizione per mostrarti attivita vicine e migliorare i suggerimenti.',
                settingsLabel: 'la posizione',
            });
            setLocationEnabled(granted);
        } else {
            setLocationEnabled(false);
        }
    };

    const toggleNotifications = async (value: boolean) => {
        if (Platform.OS === 'web') {
            setNotificationsEnabled(false);
            return;
        }

        if (value) {
            const granted = await requestNotificationPermission({
                title: 'Attiva le notifiche',
                message: 'AiutarSi ti avvisa su candidature, messaggi, aggiornamenti delle attivita e novita importanti.',
                settingsLabel: 'le notifiche',
            });
            setNotificationsEnabled(granted);
        } else {
            setNotificationsEnabled(false);
        }
    };

    const startJourney = () => {
        setPhase('transition');
    };

    if (phase === 'transition') {
        return (
            <View style={{ flex: 1, backgroundColor: "white" }}>
                <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: videoFadeAnim }]}>
                    <BrandedLoadingVideo source={onboardingLoadingVideo} startAtSeconds={2} />
                </Animated.View>
                <View style={StyleSheet.absoluteFillObject}>
                    <Animated.View 
                        style={{ flex: 1, opacity: fadeAnim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}
                    >
                        <View className="items-center mb-10">
                            <View className="relative">
                                <View className="w-36 h-36 rounded-full border-4 border-white/25 p-2">
                                    <View className="w-full h-full rounded-full overflow-hidden bg-white/10 shadow-2xl">
                                        <UserAvatar size={128} useAuthFallback={true} />
                                    </View>
                                </View>
                                <View className="absolute top-4 right-4 w-6 h-6 bg-green-500 rounded-full border-2 border-white" />
                            </View>
                        </View>

                        <Text className="text-white text-4xl font-black mb-4">Tutto pronto!</Text>
                        <Text className="text-white/85 text-lg text-center font-medium mb-10 px-8">
                            Gemma sta preparando il tuo spazio iniziale.
                        </Text>

                        <View className="w-full max-w-[320px] mb-3 flex-row justify-between items-end">
                            <Text className="text-white/65 text-[10px] font-black uppercase tracking-[3px]">Ultimi ritocchi</Text>
                            <Text className="text-white text-xl font-black">{progressPercent}%</Text>
                        </View>
                        
                        <View className="w-full max-w-[320px] h-2.5 bg-white/20 rounded-full overflow-hidden">
                            <Animated.View 
                                style={{ 
                                    width: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    }),
                                    backgroundColor: 'white'
                                }} 
                                className="h-full rounded-full"
                            />
                        </View>

                        {/* Gemma Transition Info */}
                        <View className="absolute bottom-16 bg-white/10 px-4 py-3 rounded-2xl border border-white/20 flex-row items-center w-full max-w-[340px]">
                            <View className="mr-3">
                                <GemmaAvatar size={36} bordered />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-[12px]">Gemma è pronta</Text>
                                <Text className="text-white/70 text-[10px]">Ti porto direttamente nella dashboard con i primi suggerimenti pronti.</Text>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </View>
        );
    }

    return (
        <ScreenWrapper className="bg-background-light px-0">
            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <OnboardingStepHeader
                    title="Ultimo passaggio"
                    subtitle={user?.role === "NPO"
                        ? "Attiva i permessi che servono per far trovare il tuo ente e ricevere nuove candidature."
                        : "Attiva i permessi che servono per ricevere match migliori e restare aggiornato."}
                    onBack={() => router.back()}
                />

                <View className="px-6">
                    <View 
                        className="mb-4 bg-primary/5 px-4 py-3 rounded-2xl border border-primary/10 flex-row items-center"
                    >
                        <View className="mr-3">
                            <GemmaAvatar size={36} />
                        </View>
                        <View className="flex-1">
                            <Text 
                                numberOfLines={2}
                                className="text-primary/80 font-bold text-[12px] leading-tight"
                            >
                                {user?.role === "NPO"
                                    ? "Gemma userà questi segnali per aiutarti con candidature, post e visibilità."
                                    : "Gemma userà questi segnali per proporti attività più rilevanti."}
                            </Text>
                        </View>
                    </View>

                    <View className="items-center mb-5">
                        <View className="w-full h-36 rounded-[32px] overflow-hidden items-center justify-center bg-[#f3f0ff]">
                            <LinearGradient
                                colors={['#f3f0ff', '#e9e4ff']}
                                className="absolute inset-0"
                            />
                            <View className="w-16 h-24 bg-[#a78bfa] rounded-2xl items-center justify-center shadow-xl relative">
                                <Shield size={32} color="white" strokeWidth={2.5} />
                                <View className="absolute top-1/2 left-1/2 -mt-1.5 -ml-2">
                                    <Heart size={16} color="white" fill="white" />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="gap-3">
                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex-row items-center">
                            <View className="w-11 h-11 bg-[#f3f0ff] rounded-xl items-center justify-center mr-3">
                                <MapPin size={20} color="#4c1d95" fill="#4c1d95" fillOpacity={0.1} />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-bold text-[#2d1b69]">Localizzazione</Text>
                                <Text className="text-[10px] text-secondary leading-tight font-medium" numberOfLines={2}>
                                    {user?.role === "NPO" ? "Permetti ai volontari di trovarti sulla mappa" : "Trova opportunità vicino a te"}
                                </Text>
                            </View>
                            <Switch 
                                value={locationEnabled} 
                                onValueChange={toggleLocation}
                                trackColor={{ false: '#e2e8f0', true: '#4c1d95' }}
                                thumbColor="white"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>

                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex-row items-center">
                            <View className="w-11 h-11 bg-pink-50 rounded-xl items-center justify-center mr-3">
                                <Bell size={20} color="#db2777" fill="#db2777" fillOpacity={0.1} />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-bold text-[#2d1b69]">Notifiche Push</Text>
                                <Text className="text-[10px] text-secondary leading-tight font-medium" numberOfLines={2}>
                                    {user?.role === "NPO" ? "Ricevi avvisi per nuove candidature" : "Ricevi avvisi per nuovi match"}
                                </Text>
                            </View>
                            <Switch 
                                value={notificationsEnabled} 
                                onValueChange={toggleNotifications}
                                trackColor={{ false: '#e2e8f0', true: '#4c1d95' }}
                                thumbColor="white"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                    </View>

                    <View className="mt-10">
                        <TouchableOpacity
                            onPress={startJourney}
                            className="h-16 rounded-2xl flex-row items-center justify-center shadow-xl active:scale-[0.98] bg-[#3b2391]"
                        >
                            <Text className="text-white text-lg font-bold mr-3">Inizia il tuo viaggio</Text>
                            <Rocket size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
