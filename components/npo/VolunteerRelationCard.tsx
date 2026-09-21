import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquareText, ChevronRight, Mail, X } from 'lucide-react-native';
import { UserAvatar } from '../UserAvatar';
import { AppUser } from '../../types';
import { getLegacyGamificationSnapshot } from '../../utils/gamificationLegacy';

interface VolunteerRelationCardProps {
    volunteer: AppUser;
    applicationMessage?: string;
    onPress?: () => void;
    /** Se presente, mostra il bottone messaggio (busta) accanto all'azione primaria. */
    onMessage?: () => void;
    primaryActionLabel: string;
    onPrimaryAction: () => void;
    /** 'solid' = bottone pieno colorato (design 2a); 'outline' = bordo bianco (design 2b). */
    primaryActionStyle?: 'solid' | 'outline';
    primaryActionColor?: string;
    /** Design 2b antepone un'icona chat all'azione. */
    showActionIcon?: boolean;
}

export function VolunteerRelationCard({
    volunteer,
    applicationMessage,
    onPress,
    onMessage,
    primaryActionLabel,
    onPrimaryAction,
    primaryActionStyle = 'solid',
    primaryActionColor = '#3d2f7a',
    showActionIcon = false,
}: VolunteerRelationCardProps) {
    const [showPresentation, setShowPresentation] = useState(false);
    const hasPresentation = !!applicationMessage && applicationMessage.trim() !== "";
    const { level: volunteerLevel } = getLegacyGamificationSnapshot(volunteer.id, volunteer);

    const isOnline = volunteer.lastSeenAt
        ? (Date.now() - new Date(volunteer.lastSeenAt).getTime()) < 300000
        : false;

    const getPresenceLine = () => {
        if (isOnline) return "Online ora";
        if (!volunteer.lastSeenAt) return "Offline";
        const diffMs = Date.now() - new Date(volunteer.lastSeenAt).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        if (diffMins < 60) return `Offline · ${diffMins}m fa`;
        if (diffHours < 24) return `Offline · ${diffHours}h fa`;
        return "Offline";
    };

    const areaTag = volunteer.interests && volunteer.interests.length > 0
        ? volunteer.interests[0].toUpperCase()
        : null;

    const isOutline = primaryActionStyle === 'outline';

    return (
        <TouchableOpacity
            activeOpacity={0.95}
            onPress={onPress}
            style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                overflow: 'hidden',
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 5,
            }}
        >
            <LinearGradient
                colors={['#d6006f', '#3d2f7a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 5 }}
            />

            <View style={{ padding: 22, paddingTop: 22, paddingBottom: 20, gap: 16 }}>
                {/* Header: avatar + identity */}
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                    <View style={{ position: 'relative' }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' }}>
                            <UserAvatar name={volunteer.name} avatarUrl={volunteer.avatar} size={64} showStatus={false} />
                        </View>
                        <View
                            style={{
                                position: 'absolute',
                                right: -2,
                                bottom: -2,
                                width: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: isOnline ? '#22c55e' : '#b9bec7',
                                borderWidth: 2,
                                borderColor: '#fff',
                            }}
                        />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 17, color: '#1a1730' }}>
                            {volunteer.name}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                            {areaTag && (
                                <View style={{ backgroundColor: '#f2ecfc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#7a4fd6', letterSpacing: 0.4 }}>{areaTag}</Text>
                                </View>
                            )}
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#3d2f7a' }}>{`Livello ${volunteerLevel}`}</Text>
                        </View>

                        <Text style={{ marginTop: 6, fontSize: 11.5, fontWeight: '600', color: '#8b8a99' }}>
                            {getPresenceLine()}
                        </Text>
                    </View>
                </View>

                {/* Presentazione */}
                {hasPresentation && (
                    <TouchableOpacity
                        onPress={() => setShowPresentation(true)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: '#faf9f6',
                            borderRadius: 12,
                            paddingVertical: 11,
                            paddingHorizontal: 14,
                        }}
                    >
                        <MessageSquareText size={15} color="#3d2f7a" />
                        <Text style={{ fontWeight: '800', fontSize: 13, color: '#3d2f7a' }}>Leggi presentazione</Text>
                        <ChevronRight size={16} color="#b3adcb" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                )}

                {/* Azioni */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {onMessage && (
                        <TouchableOpacity
                            onPress={onMessage}
                            style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#e7e4ef', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Mail size={18} color="#3d2f7a" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={onPrimaryAction}
                        style={{
                            flex: 1,
                            height: 44,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 8,
                            backgroundColor: isOutline ? '#fff' : primaryActionColor,
                            borderWidth: isOutline ? 1.5 : 0,
                            borderColor: '#e7e4ef',
                        }}
                    >
                        {showActionIcon && <Text style={{ fontSize: 15 }}>💬</Text>}
                        <Text style={{ fontWeight: '800', fontSize: 13.5, color: isOutline ? '#3d2f7a' : '#fff' }}>
                            {primaryActionLabel}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {hasPresentation && (
                <Modal
                    visible={showPresentation}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setShowPresentation(false)}
                >
                    <TouchableOpacity
                        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
                        activeOpacity={1}
                        onPress={() => setShowPresentation(false)}
                    >
                        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                            <View style={{ backgroundColor: "white", borderRadius: 20, padding: 20, width: 320, maxWidth: "100%" }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <Text style={{ fontWeight: '900', fontSize: 16, color: '#3d2f7a', flex: 1, marginRight: 8 }}>
                                        Presentazione di {volunteer.name}
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowPresentation(false)} hitSlop={8}>
                                        <X size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={{ color: '#334155', fontSize: 14, lineHeight: 20 }}>
                                    {applicationMessage}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}
        </TouchableOpacity>
    );
}
