import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { SoftCard } from "../SoftCard";
import { UserAvatar } from "../UserAvatar";
import { OldUser } from "../../types";
import { useRouter } from "expo-router";

interface NPOAffiliationSectionProps {
    isOwnProfile: boolean;
    affiliatedNPOs: OldUser[];
    followedNPOs?: OldUser[];
}

export function NPOAffiliationSection({ isOwnProfile, affiliatedNPOs, followedNPOs }: NPOAffiliationSectionProps) {
    const router = useRouter();

    return (
        <View className="px-6 mb-8">
            {affiliatedNPOs && affiliatedNPOs.length > 0 && (
                <View className="mb-6">
                    <Text className="text-xl font-black text-primary mb-3">
                        {isOwnProfile ? "Le Mie Associazioni" : "Associazioni"}
                    </Text>
                    {affiliatedNPOs.map(npo => (
                        <TouchableOpacity
                            key={npo.id}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/ npo - profile / ${npo.id} ` as any)}
                        >
                            <SoftCard className="flex-row items-center p-3 mb-2">
                                <View className="relative">
                                    <UserAvatar
                                        size={48}
                                        fontSize={16}
                                        name={npo.npoName || npo.name}
                                        avatarUrl={npo.avatar}
                                    />
                                    <View className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 border-2 border-white">
                                        <CheckCircle2 size={10} color="white" />
                                    </View>
                                </View>
                                <View className="flex-1 ml-3">
                                    <Text className="font-bold text-primary text-sm" numberOfLines={1}>
                                        {npo.npoName || npo.name}
                                    </Text>
                                    <View className="flex-row items-center mt-1">
                                        <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <Text className="text-[10px] text-emerald-700 font-bold">Volontario Attivo</Text>
                                        </View>
                                    </View>
                                </View>
                            </SoftCard>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {followedNPOs && followedNPOs.length > 0 && (
                <View>
                    <Text className="text-xl font-black text-primary mb-3">Associazioni Seguite</Text>
                    {followedNPOs.map(npo => (
                        <TouchableOpacity
                            key={npo.id}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/ npo - profile / ${npo.id} ` as any)}
                        >
                            <SoftCard className="flex-row items-center p-3 mb-2">
                                <View className="relative">
                                    <UserAvatar
                                        size={48}
                                        fontSize={16}
                                        name={npo.npoName || npo.name}
                                        avatarUrl={npo.avatar}
                                    />
                                </View>
                                <View className="flex-1 ml-3">
                                    <Text className="font-bold text-primary text-sm" numberOfLines={1}>
                                        {npo.npoName || npo.name}
                                    </Text>
                                    <View className="flex-row items-center mt-1">
                                        <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
                                            <Text className="text-[10px] text-indigo-700 font-bold">Follower</Text>
                                        </View>
                                    </View>
                                </View>
                            </SoftCard>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
