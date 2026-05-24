
import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, Clock, MapPin } from 'lucide-react-native';
import { colors } from "@/theme";

interface InfoCardProps {
    date: string;
    startTime: string;
    endTime: string;
    address: string;
}

export const ActivityInfoCard = ({ date, startTime, endTime, address }: InfoCardProps) => {
    return (
        <View className="flex-row gap-3 mb-6">
            {/* Date & Time Column */}
            <View className="flex-1 gap-3">
                <View className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex-1 justify-center">
                    <View className="w-10 h-10 bg-indigo-50 rounded-2xl items-center justify-center mb-2">
                        <Calendar size={20} color={colors.primary} />
                    </View>
                    <Text className="text-secondary text-[10px] font-bold uppercase tracking-widest mb-1">Data</Text>
                    <Text className="text-primary font-black text-sm">
                        {new Date(date).toLocaleDateString("it-IT", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                </View>

                <View className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex-1 justify-center">
                    <View className="w-10 h-10 bg-indigo-50 rounded-2xl items-center justify-center mb-2">
                        <Clock size={20} color={colors.primary} />
                    </View>
                    <Text className="text-secondary text-[10px] font-bold uppercase tracking-widest mb-1">Orario</Text>
                    <View>
                        <Text className="text-primary font-black text-xs">
                            {new Date(startTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text className="text-primary font-black text-xs">
                            {new Date(endTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Location Column (Taller) */}
            <View className="flex-1 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 justify-between">
                <View>
                    <View className="w-10 h-10 bg-pink-50 rounded-2xl items-center justify-center mb-2">
                        <MapPin size={20} color={colors.accent} />
                    </View>
                    <Text className="text-secondary text-[10px] font-bold uppercase tracking-widest mb-1">Luogo</Text>
                    <Text className="text-primary font-black text-sm leading-5">
                        {address}
                    </Text>
                </View>

                {/* Visual Map Placeholder or mini-map could go here */}
                <View className="h-16 bg-slate-100 rounded-xl mt-4 border border-slate-200 overflow-hidden relative">
                    {/* Just a visual cue for map */}
                    <View className="absolute inset-0 items-center justify-center opacity-20">
                        <MapPin size={32} color={colors.textSecondary} />
                    </View>
                </View>
            </View>
        </View>
    );
};
