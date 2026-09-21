import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Calendar, ChevronRight, Megaphone, X } from 'lucide-react-native';

export interface InviteActivityOption {
    id: string;
    title: string;
    dateTime: string;
}

interface InviteToActivityModalProps {
    visible: boolean;
    volunteerName: string;
    activities: InviteActivityOption[];
    onClose: () => void;
    onInviteGeneric: () => void;
    onInviteToActivity: (activityId: string, activityTitle: string) => void;
}

function formatActivityDate(dateTime: string) {
    const d = new Date(dateTime);
    const date = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
}

/**
 * Scelta NPO dopo il tap su "Invita ad attività": invito generico (tutte le attività
 * aperte, nessuna attività specifica collegata) oppure una singola attività tra le
 * prossime aperte dell'ente. Nel secondo caso la notifica porta activityId, quindi il
 * volontario che la apre atterra direttamente su quella scheda attività (vedi
 * hooks/notifications/routeResolver.ts, case ACTIVITY_UPDATE).
 */
export function InviteToActivityModal({
    visible,
    volunteerName,
    activities,
    onClose,
    onInviteGeneric,
    onInviteToActivity,
}: InviteToActivityModalProps) {
    const hasActivities = activities.length > 0;

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
                                Invita {volunteerName}
                            </Text>
                            <TouchableOpacity onPress={onClose} hitSlop={8}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: '#8b8a99', fontSize: 12.5, fontWeight: '600', marginBottom: 16 }}>
                            Scegli se invitarlo a una attività precisa o in modo generico.
                        </Text>

                        <TouchableOpacity
                            onPress={onInviteGeneric}
                            activeOpacity={0.8}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                backgroundColor: '#f2ecfc',
                                borderRadius: 12,
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                marginBottom: 14,
                            }}
                        >
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                                <Megaphone size={16} color="#7a4fd6" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', fontSize: 13.5, color: '#3d2f7a' }}>Invito generico</Text>
                                <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#8b8a99', marginTop: 1 }}>
                                    Tutte le attività aperte, nessuna nello specifico
                                </Text>
                            </View>
                            <ChevronRight size={16} color="#b3adcb" />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#8b8a99', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                            Oppure scegli un&apos;attività
                        </Text>

                        {hasActivities ? (
                            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                                {activities.map((activity) => (
                                    <TouchableOpacity
                                        key={activity.id}
                                        onPress={() => onInviteToActivity(activity.id, activity.title)}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10,
                                            paddingVertical: 11,
                                            paddingHorizontal: 12,
                                            borderRadius: 12,
                                            backgroundColor: '#faf9f6',
                                            marginBottom: 8,
                                        }}
                                    >
                                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                                            <Calendar size={15} color="#3d2f7a" />
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 13, color: '#3d2f7a' }}>
                                                {activity.title}
                                            </Text>
                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#8b8a99', marginTop: 1 }}>
                                                {formatActivityDate(activity.dateTime)}
                                            </Text>
                                        </View>
                                        <ChevronRight size={16} color="#b3adcb" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : (
                            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#8b8a99', paddingVertical: 8 }}>
                                Nessuna attività aperta al momento.
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}
