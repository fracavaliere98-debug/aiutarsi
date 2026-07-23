import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gift, Rocket, Share2, Trophy, Users } from 'lucide-react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { OnboardingStepHeader } from '../../components/onboarding/OnboardingStepHeader';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../context/AuthContext';
import { queueIntroVideoTransition } from '../../utils/introVideoTransition';
import { colors } from "@/theme";

// Ultimo step dell'onboarding volontario (dopo "welcome"), su richiesta esplicita: suggerire
// subito la condivisione del codice amico per acquisire nuovi utenti nel momento in cui
// l'engagement è più alto (appena un volontario si iscrive). Replica i contenuti/il premio già
// mostrati in app/(volunteer)/referral.tsx (impostazioni), adattati allo stile onboarding.
export default function InviteFriendScreen() {
    const router = useRouter();
    const { user, getReferralCount, updateUserProfile } = useAuth();
    const [count, setCount] = useState(0);
    const [isLoadingCount, setIsLoadingCount] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);

    const fetchCount = useCallback(async () => {
        if (!user?.id) {
            setCount(0);
            setIsLoadingCount(false);
            return;
        }
        setIsLoadingCount(true);
        try {
            const c = await getReferralCount();
            setCount(c);
        } catch (error) {
            console.error("Error fetching referral count:", error);
            setCount(0);
        } finally {
            setIsLoadingCount(false);
        }
    }, [getReferralCount, user?.id]);

    useEffect(() => {
        fetchCount();
    }, [fetchCount]);

    const referralCode = user?.referral_code || user?.id?.substring(0, 8).toUpperCase() || "N/A";
    const shareLink = `https://aiutarsi.app/referral/${referralCode}`;

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Unisciti a me su AiutarSi! Usa il mio codice amico ${referralCode} per sbloccare il badge "Coppia Vincente" e 500 XP extra dopo la tua prima missione. Scarica l'app qui: ${shareLink}`,
                url: shareLink,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const finishOnboarding = async () => {
        if (isFinishing) return;
        setIsFinishing(true);
        try {
            await updateUserProfile({ profile_completed: true });
            queueIntroVideoTransition();
            router.replace("/(volunteer)/(tabs)/community" as any);
        } finally {
            setIsFinishing(false);
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
                    title="Porta un amico con te"
                    subtitle="Il volontariato è più bello in compagnia. Condividi il tuo codice e guadagnate entrambi un premio."
                    onBack={() => router.back()}
                />

                <View className="px-6">
                    <SoftCard className="p-6 items-center mb-6">
                        <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-4">
                            <Users size={32} color={colors.primary} />
                        </View>
                        <Text className="text-xl font-black text-primary text-center mb-2">
                            Invita i tuoi amici!
                        </Text>
                        <Text className="text-secondary text-center font-medium leading-relaxed">
                            Condividi subito il tuo codice amico: appena qualcuno si iscrive con il tuo codice, ricevete entrambi un premio.
                        </Text>
                    </SoftCard>

                    <View className="flex-row gap-4 mb-6">
                        <SoftCard className="flex-1 p-4 items-center">
                            <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center mb-2">
                                <Trophy size={20} color="#a855f7" />
                            </View>
                            <Text className="text-[10px] uppercase tracking-widest font-bold text-secondary/60 mb-1 text-center">Premio</Text>
                            <Text className="font-black text-primary text-[13px] text-center" numberOfLines={2}>+500 XP per ogni amico</Text>
                        </SoftCard>
                        <SoftCard className="flex-1 p-4 items-center">
                            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mb-2">
                                <Users size={20} color={colors.primary} />
                            </View>
                            <Text className="text-[10px] uppercase tracking-widest font-bold text-secondary/60 mb-1">Amici Invitati</Text>
                            {isLoadingCount ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text className="font-black text-primary text-xl">{count}</Text>
                            )}
                        </SoftCard>
                    </View>

                    <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-3 ml-2">Il tuo Codice Amico</Text>
                    <TouchableOpacity
                        className="flex-row items-center justify-between bg-white border-2 border-dashed border-primary/20 p-5 rounded-3xl mb-8 shadow-sm"
                        onPress={handleShare}
                        activeOpacity={0.7}
                        testID="onboarding-invite-share-code"
                    >
                        <View>
                            <Text className="text-3xl font-black text-primary tracking-widest">{referralCode}</Text>
                            <Text className="text-xs text-secondary/60 font-medium mt-1">Tocca per condividere il link</Text>
                        </View>
                        <View className="bg-primary p-4 rounded-2xl shadow-md">
                            <Share2 size={24} color="white" />
                        </View>
                    </TouchableOpacity>

                    <View className="bg-primary/5 p-5 rounded-3xl border border-primary/5 mb-10">
                        <View className="flex-row items-center gap-3 mb-4">
                            <View className="bg-primary/20 p-2 rounded-lg">
                                <Gift size={16} color={colors.primary} />
                            </View>
                            <Text className="text-base font-black text-primary">Come funziona?</Text>
                        </View>
                        <View className="gap-4">
                            <View className="flex-row gap-3">
                                <View className="w-6 h-6 rounded-full bg-primary items-center justify-center mt-0.5">
                                    <Text className="text-white text-[11px] font-black">1</Text>
                                </View>
                                <Text className="flex-1 text-secondary font-medium text-sm leading-5">Condividi il tuo codice con un amico che non è ancora su AiutarSi.</Text>
                            </View>
                            <View className="flex-row gap-3">
                                <View className="w-6 h-6 rounded-full bg-primary items-center justify-center mt-0.5">
                                    <Text className="text-white text-[11px] font-black">2</Text>
                                </View>
                                <Text className="flex-1 text-secondary font-medium text-sm leading-5">L&apos;amico si iscrive inserendo il tuo codice amico in fase di onboarding.</Text>
                            </View>
                            <View className="flex-row gap-3">
                                <View className="w-6 h-6 rounded-full bg-primary items-center justify-center mt-0.5">
                                    <Text className="text-white text-[11px] font-black">3</Text>
                                </View>
                                <Text className="flex-1 text-secondary font-medium text-sm leading-5">Quando il tuo amico completa la sua prima missione, ricevete entrambi il premio!</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={finishOnboarding}
                        disabled={isFinishing}
                        className={`h-16 rounded-2xl flex-row items-center justify-center shadow-xl active:scale-[0.98] ${isFinishing ? 'opacity-70' : ''}`}
                        style={{ backgroundColor: colors.primary }}
                        testID="onboarding-invite-continue"
                    >
                        {isFinishing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white text-lg font-bold mr-3">Inizia il tuo viaggio</Text>
                                <Rocket size={20} color="white" />
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={finishOnboarding}
                        disabled={isFinishing}
                        className="mt-4 items-center"
                        testID="onboarding-invite-skip"
                    >
                        <Text className="text-secondary font-bold text-sm">Salta per ora, lo farò più tardi</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
