import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { SoftCard } from './SoftCard';
import { User } from '../types';

interface VolunteerCardProps {
    volunteer: User;
    onPress?: () => void;
    actions?: React.ReactNode;
}

export function VolunteerCard({ volunteer, onPress, actions }: VolunteerCardProps) {
    // Presence logic: Online if lastSeenAt is within the last 5 minutes
    const isOnline = volunteer.lastSeenAt
        ? (new Date().getTime() - new Date(volunteer.lastSeenAt).getTime()) < 300000 // 5 mins
        : false;

    const getStatusText = () => {
        if (isOnline) return "Online ora";
        if (!volunteer.lastSeenAt) return "Offline";

        const diffMs = new Date().getTime() - new Date(volunteer.lastSeenAt).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 60) return `Offline (${diffMins}m fa)`;
        if (diffHours < 24) return `Offline (${diffHours}h fa)`;
        return "Offline";
    };

    const statusText = getStatusText();

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={{
                backgroundColor: '#f0f2f5',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#d1d9e6',
                shadowOffset: { width: 6, height: 6 },
                shadowOpacity: 1,
                shadowRadius: 12,
                elevation: 4,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.4)',
            }}
        >
            {/* Avatar Section */}
            <View className="relative">
                <View
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        overflow: 'hidden',
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        backgroundColor: '#e1e5ea',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2
                    }}
                >
                    <UserAvatar
                        name={volunteer.name}
                        avatarUrl={volunteer.avatar}
                        size={64}
                        showStatus={false} // Custom status dot manually
                    />
                </View>
                {/* Custom Status Dot - Fixed bottom right */}
                <View
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: isOnline ? '#22c55e' : '#cbd5e1',
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2
                    }}
                />
            </View>

            {/* Content Section */}
            <View className="flex-1 ml-4 justify-center">
                <View className="flex-row justify-between items-center mb-0.5">
                    <Text
                        className="text-slate-900 font-bold text-base flex-1 mr-2"
                        numberOfLines={1}
                        style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                        {volunteer.name}
                    </Text>
                    {volunteer.locationString && (
                        <View className="bg-accent px-2 py-0.5 rounded-full">
                            <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                                {volunteer.locationString.includes('-')
                                    ? volunteer.locationString.split('-').pop()?.trim().toUpperCase()
                                    : volunteer.locationString.split(',')[0].trim().toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Interests - Directly under name */}
                <Text
                    className="text-primary text-[10px] font-bold uppercase tracking-normal"
                    numberOfLines={1}
                >
                    {volunteer.interests && volunteer.interests.length > 0
                        ? volunteer.interests.slice(0, 3).join(", ").toUpperCase()
                        : "Nessun interesse"}
                </Text>

                {/* Status - Relative time */}
                <View className="flex-row items-center mt-1">
                    <View
                        className={`w-2 h-2 rounded-full flex items-center justify-center mr-1.5 ${isOnline ? 'bg-green-500/20' : 'bg-slate-300/20'}`}
                    >
                        <View className={`w-1 h-1 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                    </View>
                    <Text
                        className={`text-[11px] font-medium ${isOnline ? 'text-slate-500' : 'text-slate-400'}`}
                    >
                        {statusText}
                    </Text>
                </View>

                {actions && (
                    <View className="flex-row mt-3 items-center">
                        {actions}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
