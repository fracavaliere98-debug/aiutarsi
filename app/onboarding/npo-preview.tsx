import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, CheckCircle2, Clock, Globe, MapPin, MessageCircle, ShieldCheck, Star, Users } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { StandardLayout } from '../../components/StandardLayout';
import { SoftCard } from '../../components/SoftCard';
import { StatCard } from '../../components/StatCard';
import { UserAvatar } from '../../components/UserAvatar';

export default function NPOPreviewScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const categories = user?.interests || [];
    const soughtSkills = user?.sought_skills || [];
    const verificationStatus = user?.verification_status;

    return (
        <StandardLayout
            title="Anteprima profilo"
            label="Onboarding NPO"
            onBack={() => router.back()}
            bg="bg-background-light"
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
                <View className="items-center mb-6">
                    <View className="relative mb-3">
                        <UserAvatar
                            size={100}
                            fontSize={34}
                            name={user?.npo_name || user?.name || 'Ente'}
                            avatarUrl={(user?.avatar_url || user?.avatar) as string | undefined}
                            role="NPO"
                            isVerified={!!(user?.isVerified || user?.is_verified)}
                            verificationStatus={verificationStatus}
                        />
                    </View>

                    <Text className="text-primary font-black text-2xl text-center mb-1">
                        {user?.npo_name || user?.name || 'Il tuo ente'}
                    </Text>
                    <Text className="text-secondary font-medium text-sm text-center mb-4 mt-1">
                        Comitato locale • {user?.address_full || user?.locationString || 'Sede operativa da definire'}
                    </Text>

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: verificationStatus === 'pending' ? '#fff7ed' : '#f8f4ff',
                        }}
                    >
                        <ShieldCheck size={16} color={verificationStatus === 'pending' ? '#c2410c' : Colors.primary} />
                        <Text style={{ color: verificationStatus === 'pending' ? '#c2410c' : Colors.primary, fontSize: 12, fontWeight: '700' }}>
                            {verificationStatus === 'pending' ? 'Verifica inviata' : 'Profilo in preparazione'}
                        </Text>
                    </View>
                </View>

                <View className="flex-row gap-3 mb-8">
                    <View className="flex-1 h-24">
                        <StatCard value="0.0" label="RATING" valueColor="text-yellow-500" icon={<Star size={14} color="#eab308" fill="#eab308" />} />
                    </View>
                    <View className="flex-1 h-24">
                        <StatCard value="0" label="FOLLOWER" valueColor="text-pink-600" icon={<Users size={14} color="#db2777" />} />
                    </View>
                    <View className="flex-1 h-24">
                        <StatCard value="0" label="ORE DONATE" valueColor="text-indigo-600" icon={<Clock size={14} color="#4f46e5" />} />
                    </View>
                </View>

                <SoftCard className="p-5 mb-4">
                    <Text className="text-primary font-bold text-base mb-3">Informazioni</Text>
                    <View className="gap-4">
                        {!!user?.website && (
                            <View className="flex-row items-center gap-3">
                                <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                    <Globe size={16} color={Colors.primary} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-secondary text-xs font-bold uppercase">Sito web</Text>
                                    <Text className="text-primary font-medium" numberOfLines={1}>{user.website}</Text>
                                </View>
                            </View>
                        )}

                        <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                <MapPin size={16} color={Colors.primary} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-secondary text-xs font-bold uppercase">Sede operativa</Text>
                                <Text className="text-primary font-medium">{user?.address_full || 'Da completare'}</Text>
                            </View>
                        </View>
                    </View>
                </SoftCard>

                <SoftCard className="p-5 mb-4">
                    <Text className="text-primary font-bold text-base mb-2">Chi siete</Text>
                    <Text className="text-secondary leading-relaxed text-sm">
                        {user?.bio || 'Aggiungi una breve missione per raccontare meglio il tuo ente ai volontari.'}
                    </Text>
                </SoftCard>

                <SoftCard className="p-5 mb-4">
                    <Text className="text-primary font-bold text-base mb-3">Aree di intervento</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {categories.length > 0 ? categories.map((category, index) => (
                            <View key={`${category}_${index}`} className="bg-gray-100 px-3 py-2 rounded-xl">
                                <Text className="text-primary text-xs font-bold">{category}</Text>
                            </View>
                        )) : (
                            <Text className="text-secondary text-sm">Nessun settore selezionato</Text>
                        )}
                    </View>
                </SoftCard>

                <SoftCard className="p-5 mb-4">
                    <Text className="text-primary font-bold text-base mb-3">Skill ricercate</Text>
                    <View className="gap-2">
                        {soughtSkills.length > 0 ? soughtSkills.map((skill, index) => (
                            <View key={`${skill}_${index}`} className="flex-row items-center gap-2">
                                <CheckCircle2 size={14} color={Colors.accent} />
                                <Text className="text-secondary text-sm">{skill}</Text>
                            </View>
                        )) : (
                            <Text className="text-secondary text-sm">Nessuna skill selezionata</Text>
                        )}
                    </View>
                </SoftCard>

                <SoftCard className="p-5 mb-6">
                    <Text className="text-primary font-bold text-base mb-3">Referente</Text>
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3 flex-1">
                            <UserAvatar
                                size={50}
                                name={user?.referent_name || 'Referente'}
                                avatarUrl={user?.referent_avatar_url as string | undefined}
                                fontSize={20}
                            />
                            <View className="flex-1">
                                <Text className="text-primary font-bold text-sm">{user?.referent_name || 'Da completare'}</Text>
                                <Text className="text-secondary text-xs">{user?.referent_role || 'Ruolo referente'}</Text>
                            </View>
                        </View>
                        <View className="bg-primary/10 p-2 rounded-full">
                            <MessageCircle size={18} color={Colors.primary} />
                        </View>
                    </View>
                </SoftCard>

                <TouchableOpacity
                    onPress={() => router.push('/onboarding/welcome')}
                    className="bg-primary py-4 rounded-2xl items-center justify-center flex-row"
                    style={{ gap: 10 }}
                >
                    <Text className="text-white text-lg font-bold">Continua</Text>
                    <ArrowRight size={20} color="white" />
                </TouchableOpacity>
            </ScrollView>
        </StandardLayout>
    );
}
