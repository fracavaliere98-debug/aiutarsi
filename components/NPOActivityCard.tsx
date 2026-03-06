import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../constants/Colors';
import { SoftCard } from './SoftCard';
import { OldActivity } from '../types';
import { useRouter } from 'expo-router';

interface NPOActivityCardProps {
    activity: OldActivity;
    onPress?: () => void;
}

export function NPOActivityCard({ activity, onPress }: NPOActivityCardProps) {
    const router = useRouter();
    const progress = (activity.iscritti.length / activity.slots) * 100;

    const getStatusColor = (status: string) => {
        switch (status) {
            case "CANCELLATA": return { bg: "bg-red-500", text: "text-white" };
            case "COMPLETATA": return { bg: "bg-emerald-500", text: "text-white" };
            case "IN_CORSO": return { bg: "bg-orange-500", text: "text-white" };
            default: return { bg: "bg-green-500", text: "text-white" };
        }
    };

    const statusStyle = getStatusColor(activity.status);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            router.push(`/activity/${activity.id}` as any);
        }
    };

    return (
        <SoftCard
            className="p-4 flex-row items-center"
            onPress={handlePress}
        >
            {/* Image with Status Badge */}
            <View className="relative w-20 h-20 rounded-2xl overflow-hidden mr-4">
                <Image
                    source={{ uri: activity.imageUrl || "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=200" }}
                    className="w-full h-full"
                />
                <View className={`absolute top-0 right-0 px-2 py-0.5 rounded-bl-xl ${statusStyle.bg}`}>
                    <Text className="text-white font-black text-[7px] uppercase tracking-wider">{activity.status}</Text>
                </View>
            </View>

            {/* Content */}
            <View className="flex-1 justify-center">
                <View className="flex-row justify-between items-start mb-1.5">
                    <View className="flex-1 mr-2">
                        <Text className="text-slate-900 font-extrabold text-sm mb-0.5" numberOfLines={1}>
                            {activity.title}
                        </Text>
                        <Text className="text-slate-400 text-[10px] font-bold">
                            {new Date(activity.dateTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} • {new Date(activity.dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <View className="self-start px-2 py-0.5 rounded-lg mt-1.5" style={{ backgroundColor: `${Colors.primary}15` }}>
                            <Text className="font-black text-[8px] uppercase" style={{ color: Colors.primary }}>
                                {activity.category}
                            </Text>
                        </View>
                    </View>

                    {/* Management Button */}
                    <View
                        className="bg-[#f0f2f5] px-3 py-1.5 rounded-lg border border-white/50"
                        style={{ elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }}
                    >
                        <Text className="font-black text-[9px]" style={{ color: Colors.primary }}>Gestisci</Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <View className="mt-2">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-[9px] text-slate-500 font-bold">
                            {activity.iscritti.length}/{activity.slots} Iscritti
                        </Text>
                    </View>
                    <View className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <View
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: Colors.primary }}
                        />
                    </View>
                </View>
            </View>
        </SoftCard>
    );
}
