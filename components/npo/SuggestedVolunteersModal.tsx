import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Check, Sparkles, X } from 'lucide-react-native';
import { UserAvatar } from '../UserAvatar';
import type { SuggestedVolunteer } from '../../services/NPOService';

/** Compatibilità mostrata all'ente: una sola regola. Sotto 0,85 (soglia minima del server: 0,70) è "Buona". */
export const GREAT_MATCH_THRESHOLD = 0.85;

export function matchLabel(score: number | null): string | null {
    if (score === null) return null;
    return score >= GREAT_MATCH_THRESHOLD ? 'Ottima compatibilità' : 'Buona compatibilità';
}

interface SuggestedVolunteersModalProps {
    visible: boolean;
    activityTitle: string;
    volunteers: SuggestedVolunteer[];
    /** Inviti mirati già mandati per questa attività (dal server). */
    invitedCount: number;
    maxInvites: number;
    isLoading: boolean;
    isError: boolean;
    /** Id del volontario con un invito in corso (bottone disabilitato). */
    sendingId?: string | null;
    onRetry: () => void;
    onClose: () => void;
    onInvite: (volunteerId: string) => void;
}

/**
 * Volontari consigliati per UNA attività, aperta dalla scheda attività dell'ente. Stessa UI della
 * modale "Invita ad attività" (components/npo/InviteToActivityModal.tsx). L'ente vede solo nome, foto
 * e compatibilità: nessun contatto, posizione o competenza. Il tetto di inviti per attività è
 * applicato dal server (send_npo_invite); qui si mostra il contatore e si disabilita "Invita".
 */
export function SuggestedVolunteersModal({
    visible,
    activityTitle,
    volunteers,
    invitedCount,
    maxInvites,
    isLoading,
    isError,
    sendingId = null,
    onRetry,
    onClose,
    onInvite,
}: SuggestedVolunteersModalProps) {
    const limitReached = invitedCount >= maxInvites;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                    <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 20, width: 340, maxWidth: '100%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontWeight: '900', fontSize: 16, color: '#3d2f7a', flex: 1, marginRight: 8 }}>
                                I tuoi volontari consigliati
                            </Text>
                            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Chiudi">
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <Text numberOfLines={2} style={{ color: '#8b8a99', fontSize: 12.5, fontWeight: '600', marginBottom: 10 }}>
                            Per &quot;{activityTitle}&quot;
                        </Text>

                        <View style={{
                            backgroundColor: limitReached ? '#fef3c7' : '#f2ecfc',
                            borderRadius: 12,
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                            marginBottom: 12,
                        }}>
                            <Text style={{ fontWeight: '800', fontSize: 12.5, color: limitReached ? '#92400e' : '#3d2f7a' }}>
                                {`Inviti mandati: ${invitedCount} su ${maxInvites}`}
                            </Text>
                            {limitReached && (
                                <Text style={{ fontWeight: '600', fontSize: 11.5, color: '#92400e', marginTop: 2 }}>
                                    Hai raggiunto il massimo di inviti per questa attività.
                                </Text>
                            )}
                        </View>

                        {isLoading ? (
                            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                <ActivityIndicator color="#7a4fd6" />
                            </View>
                        ) : isError ? (
                            <View style={{ paddingVertical: 8, gap: 10 }}>
                                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#8b8a99' }}>
                                    Non riesco a caricare i tuoi volontari. Riprova tra poco.
                                </Text>
                                <TouchableOpacity
                                    onPress={onRetry}
                                    style={{ alignSelf: 'flex-start', backgroundColor: '#f2ecfc', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }}
                                >
                                    <Text style={{ fontWeight: '800', fontSize: 12.5, color: '#3d2f7a' }}>Riprova</Text>
                                </TouchableOpacity>
                            </View>
                        ) : volunteers.length === 0 ? (
                            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#8b8a99', paddingVertical: 8 }}>
                                Nessuno dei tuoi volontari risulta adatto a questa attività. Per un aiuto last minute puoi invitare i tuoi follower dalla scheda Follower.
                            </Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                                {volunteers.map((volunteer) => {
                                    const label = matchLabel(volunteer.score);
                                    const invited = volunteer.alreadyInvited;
                                    const sending = sendingId === volunteer.id;
                                    const disabled = limitReached || sending;
                                    return (
                                        <View
                                            key={volunteer.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 10,
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderRadius: 12,
                                                backgroundColor: '#faf9f6',
                                                marginBottom: 8,
                                            }}
                                        >
                                            <UserAvatar name={volunteer.name} avatarUrl={volunteer.avatar} size={36} />
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 13, color: '#3d2f7a' }}>
                                                    {volunteer.name}
                                                </Text>
                                                {label && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                        <Sparkles size={11} color="#7a4fd6" />
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#7a4fd6' }}>{label}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {invited ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 }}>
                                                    <Check size={13} color="#15803d" />
                                                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#15803d' }}>Già invitato</Text>
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => onInvite(volunteer.id)}
                                                    disabled={disabled}
                                                    accessibilityState={{ disabled }}
                                                    activeOpacity={0.8}
                                                    style={{
                                                        backgroundColor: disabled ? '#e5e7eb' : '#7a4fd6',
                                                        borderRadius: 10,
                                                        paddingVertical: 8,
                                                        paddingHorizontal: 14,
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '800', color: disabled ? '#9ca3af' : 'white' }}>
                                                        {sending ? 'Invio…' : 'Invita'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}
