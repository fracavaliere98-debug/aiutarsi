import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquareText, ChevronRight, Mail, X } from 'lucide-react-native';
import { UserAvatar } from '../UserAvatar';
import { AppUser } from '../../types';
import { getLegacyGamificationSnapshot } from '../../utils/gamificationLegacy';

interface CandidacyCardProps {
    volunteer: AppUser;
    appliedDate: string;
    applicationMessage?: string;
    onPress?: () => void;
    onMessage: () => void;
    onReject: () => void;
    onApprove: () => void;
}

function formatAppliedAgo(timestamp: string) {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "adesso";
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
    if (diffDays === 1) return "1 giorno fa";
    return `${diffDays} giorni fa`;
}

export function CandidacyCard({ volunteer, appliedDate, applicationMessage, onPress, onMessage, onReject, onApprove }: CandidacyCardProps) {
    const [showPresentation, setShowPresentation] = useState(false);
    const hasPresentation = !!applicationMessage && applicationMessage.trim() !== "";
    const { level: volunteerLevel } = getLegacyGamificationSnapshot(volunteer.id, volunteer);

    const isOnline = volunteer.lastSeenAt
        ? (Date.now() - new Date(volunteer.lastSeenAt).getTime()) < 300000
        : false;

    const getPresenceText = () => {
        if (isOnline) return "online ora";
        if (!volunteer.lastSeenAt) return "offline";
        const diffMs = Date.now() - new Date(volunteer.lastSeenAt).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        if (diffMins < 60) return `offline ${diffMins}m fa`;
        if (diffHours < 24) return `offline ${diffHours}h fa`;
        return "offline";
    };

    const appliedHoursAgo = (Date.now() - new Date(appliedDate).getTime()) / 3600000;
    const isNew = appliedHoursAgo < 24;

    const areaTag = volunteer.interests && volunteer.interests.length > 0
        ? volunteer.interests[0].toUpperCase()
        : null;

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
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Text numberOfLines={1} style={{ flex: 1, fontWeight: '800', fontSize: 17, color: '#1a1730' }}>
                                {volunteer.name}
                            </Text>
                            {isNew && (
                                <View style={{ backgroundColor: '#f2ecfc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#7a4fd6', letterSpacing: 0.4 }}>NUOVO</Text>
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                            {areaTag && (
                                <View style={{ backgroundColor: '#f2ecfc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#7a4fd6', letterSpacing: 0.4 }}>{areaTag}</Text>
                                </View>
                            )}
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#3d2f7a' }}>{`Livello ${volunteerLevel}`}</Text>
                        </View>

                        <Text style={{ marginTop: 6, fontSize: 11.5, fontWeight: '600', color: '#8b8a99' }}>
                            {`Candidatura ricevuta ${formatAppliedAgo(appliedDate)} · ${getPresenceText()}`}
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
                    <TouchableOpacity
                        onPress={onMessage}
                        style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#e7e4ef', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Mail size={18} color="#3d2f7a" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onReject}
                        style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#e7e4ef', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ fontWeight: '800', fontSize: 13.5, color: '#c4344a' }}>Rifiuta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onApprove}
                        style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#3d2f7a', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ fontWeight: '800', fontSize: 13.5, color: '#fff' }}>Approva</Text>
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
                                {/* Niente ScrollView senza altezza esplicita: era il bug reale (popup con solo il
                                    titolo, corpo vuoto) — Yoga risolveva l'altezza della ScrollView a 0 dentro un
                                    genitore con solo maxHeight in percentuale. Testo breve, non serve scroll. */}
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
