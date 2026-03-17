import { View, Text, TouchableOpacity, Share, ActivityIndicator, ScrollView } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { StandardLayout } from "../../components/StandardLayout";
import { SoftCard } from "../../components/SoftCard";
import { Colors } from "../../constants/Colors";
import { Share2, Users, Trophy, Gift } from "lucide-react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";

export default function ReferralScreen() {
    const { user, getReferralCount } = useAuth();
    const [count, setCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchCount = async () => {
            if (user) {
                const c = await getReferralCount();
                setCount(c);
            }
            setIsLoading(false);
        };
        fetchCount();
    }, [user?.id]);

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

    return (
        <StandardLayout
            label="Porta un amico"
            title="Referral Program"
            onBack={() => router.back()}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="px-6 py-4">
                    <SoftCard className="p-6 items-center mb-8">
                        <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-4">
                            <Users size={32} color={Colors.primary} />
                        </View>
                        <Text className="text-2xl font-black text-primary text-center mb-2">
                            Invita i tuoi amici!
                        </Text>
                        <Text className="text-secondary text-center font-medium leading-relaxed">
                            Il volontariato è più divertente se fatto in compagnia. Invita un amico e ricevete entrambi un premio speciale!
                        </Text>
                    </SoftCard>

                    <View className="flex-row gap-4 mb-8">
                        <SoftCard className="flex-1 p-4 items-center">
                            <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center mb-2">
                                <Trophy size={20} color="#a855f7" />
                            </View>
                            <Text className="text-[10px] uppercase tracking-widest font-bold text-secondary/60 mb-1 text-center">Premio</Text>
                            <Text className="font-black text-primary text-[13px] text-center" numberOfLines={2}>+500 XP per ogni amico</Text>
                        </SoftCard>
                        <SoftCard className="flex-1 p-4 items-center">
                            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mb-2">
                                <Users size={20} color={Colors.primary} />
                            </View>
                            <Text className="text-[10px] uppercase tracking-widest font-bold text-secondary/60 mb-1">Amici Invitati</Text>
                            {isLoading ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <Text className="font-black text-primary text-xl">{count}</Text>
                            )}
                        </SoftCard>
                    </View>

                    <Text className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-3 ml-2">Il tuo Codice Amico</Text>
                    <TouchableOpacity 
                        className="flex-row items-center justify-between bg-white border-2 border-dashed border-primary/20 p-5 rounded-3xl mb-10 shadow-sm"
                        onPress={handleShare}
                        activeOpacity={0.7}
                    >
                        <View>
                            <Text className="text-3xl font-black text-primary tracking-widest">{referralCode}</Text>
                            <Text className="text-xs text-secondary/60 font-medium mt-1">Tocca per condividere il link</Text>
                        </View>
                        <View className="bg-primary p-4 rounded-2xl shadow-md">
                            <Share2 size={24} color="white" />
                        </View>
                    </TouchableOpacity>

                    <View className="bg-primary/5 p-6 rounded-3xl border border-primary/5">
                        <View className="flex-row items-center gap-3 mb-6">
                            <View className="bg-primary/20 p-2 rounded-lg">
                                <Gift size={18} color={Colors.primary} />
                            </View>
                            <Text className="text-lg font-black text-primary">Come funziona?</Text>
                        </View>
                        <View className="gap-6">
                            <View className="flex-row gap-4">
                                <View className="w-7 h-7 rounded-full bg-primary items-center justify-center mt-0.5">
                                    <Text className="text-white text-xs font-black">1</Text>
                                </View>
                                <Text className="flex-1 text-secondary font-medium text-sm leading-5">Condividi il tuo codice con un amico che non è ancora su AiutarSi.</Text>
                            </View>
                            <View className="flex-row gap-4">
                                <View className="w-7 h-7 rounded-full bg-primary items-center justify-center mt-0.5">
                                    <Text className="text-white text-xs font-black">2</Text>
                                </View>
                                <Text className="flex-1 text-secondary font-medium text-sm leading-5">L'amico si iscrive inserendo il tuo codice amico in fase di onboarding.</Text>
                            </View>
                            <View className="flex-row gap-4">
                                <View className="w-7 h-7 rounded-full bg-primary items-center justify-center mt-0.5">
                                    <Text className="text-white text-xs font-black">3</Text>
                                </View>
                                <Text className="flex-1 text-secondary font-medium text-sm leading-5">Quando il tuo amico completa la sua prima missione, ricevete entrambi il premio!</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </StandardLayout>
    );
}
