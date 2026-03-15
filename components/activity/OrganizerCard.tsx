
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { UserAvatar } from '../UserAvatar';
import { Link } from 'expo-router';

interface OrganizerCardProps {
    npoId: string;
    npoName: string;
    avatarUrl?: string;
    isVerified?: boolean;
}

export const OrganizerCard = ({ npoId, npoName, avatarUrl, isVerified }: OrganizerCardProps) => {
    return (
        <Link href={`/npo-profile/${npoId}`} asChild>
            <TouchableOpacity className="bg-slate-50 p-4 rounded-[24px] flex-row items-center gap-4 border border-slate-200/60 mb-8 active:bg-slate-100">
                <UserAvatar
                    size={48}
                    fontSize={16}
                    name={npoName}
                    avatarUrl={avatarUrl}
                    role="NPO"
                    isVerified={isVerified}
                />
                <View className="flex-1">
                    <Text className="text-secondary text-[10px] font-bold uppercase tracking-widest mb-0.5">Organizzato da</Text>
                    <View className="flex-row items-center gap-1.5">
                        <Text className="font-black text-primary text-base" numberOfLines={1}>
                            {npoName}
                        </Text>
                    </View>
                </View>
                <View className="bg-white p-2 rounded-full shadow-sm">
                    <ChevronRight size={20} color={Colors.primary} />
                </View>
            </TouchableOpacity>
        </Link>
    );
};
