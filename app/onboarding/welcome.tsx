import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Bell, Rocket } from 'lucide-react-native';
import { GemmaAvatar } from '../../components/GemmaAvatar';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { requestForegroundLocationPermission, requestNotificationPermission } from '../../utils/permissions';
import { queueIntroVideoTransition } from '../../utils/introVideoTransition';
import { colors } from "@/theme";

export default function WelcomeScreen() {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();
    const isNPO = user?.role === "NPO";
    const [isStartingJourney, setIsStartingJourney] = useState(false);
    
    // Phase 1 States
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

    const startJourney = async () => {
        if (isStartingJourney) return;
        setIsStartingJourney(true);
        try {
            await updateUserProfile({ profile_completed: true });
            queueIntroVideoTransition();
            if (user?.role === "NPO") {
                router.replace("/(npo)/(tabs)/community" as any);
            } else {
                router.replace("/(volunteer)/(tabs)/community" as any);
            }
        } finally {
            setIsStartingJourney(false);
        }
    };

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

                <View style={{ flexDirection: 'row', gap: 6, paddingLeft: 24, marginBottom: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border }} />
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border }} />
                    {isNPO && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border }} />}
                    <View style={{ width: 24, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                </View>

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
                        <View
                            style={{
                                width: '100%',
                                height: 100,
                                borderRadius: 24,
                                borderWidth: 2,
                                borderStyle: 'dashed',
                                borderColor: colors.primarySoft,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surfaceSubtle,
                            }}
                        >
                            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                                Illustrazione Gemma — in arrivo
                            </Text>
                        </View>
                    </View>

                    <View className="gap-3">
                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex-row items-center">
                            <View className="w-11 h-11 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.primarySoft }}>
                                <MapPin size={20} color={colors.primary} fill={colors.primary} fillOpacity={0.1} />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-bold" style={{ color: colors.text }}>Localizzazione</Text>
                                <Text className="text-[10px] text-secondary leading-tight font-medium" numberOfLines={2}>
                                    {user?.role === "NPO" ? "Permetti ai volontari di trovarti sulla mappa" : "Trova opportunità vicino a te"}
                                </Text>
                            </View>
                            <Switch
                                value={locationEnabled}
                                onValueChange={toggleLocation}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="white"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>

                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex-row items-center">
                            <View className="w-11 h-11 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.accentSoft }}>
                                <Bell size={20} color={colors.accent} fill={colors.accent} fillOpacity={0.1} />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-bold" style={{ color: colors.text }}>Notifiche Push</Text>
                                <Text className="text-[10px] text-secondary leading-tight font-medium" numberOfLines={2}>
                                    {user?.role === "NPO" ? "Ricevi avvisi per nuove candidature" : "Ricevi avvisi per nuovi match"}
                                </Text>
                            </View>
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={toggleNotifications}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="white"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                    </View>

                    <View className="mt-10">
                        <TouchableOpacity
                            onPress={startJourney}
                            disabled={isStartingJourney}
                            className={`h-16 rounded-2xl flex-row items-center justify-center shadow-xl active:scale-[0.98] ${isStartingJourney ? 'opacity-70' : ''}`}
                            style={{ backgroundColor: colors.primary }}
                        >
                            {isStartingJourney ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white text-lg font-bold mr-3">Inizia il tuo viaggio</Text>
                                    <Rocket size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
