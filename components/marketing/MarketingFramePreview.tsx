import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Bell, CheckCircle, Info, AlertCircle, MessageCircle } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { CommunityHero } from '../community/CommunityHero';
import { CommunityCompactPostCard } from '../community/CommunityCompactPostCard';
import { type MarketingPreviewKind } from '../../utils/marketingFrames';
import { type CommunityPost } from '../../types/community';

interface MarketingFramePreviewProps {
    preview: MarketingPreviewKind;
}

const mockCommunityPost: CommunityPost = {
    id: 'marketing_post_community',
    author_id: 'volunteer_demo',
    caption: 'Sono entrata per aiutare e sono uscita sentendomi parte di qualcosa.',
    image_url: null,
    images_urls: null,
    linked_activity_id: 'activity_demo',
    created_at: new Date().toISOString(),
    status: 'published' as any,
    author: {
        id: 'volunteer_demo',
        full_name: 'Sara Conti',
        npo_name: null,
        avatar_url: null,
        role: 'VOLUNTEER',
    },
    linked_activity: {
        id: 'activity_demo',
        title: 'Distribuzione pasti del sabato',
        date_start: new Date().toISOString(),
        status: 'APERTA',
    },
    reactions: [],
} as CommunityPost;

function MiniStoriesRow() {
    const stories: { id: string; label: string }[] = [
        { id: 's1', label: 'Croce' },
        { id: 's2', label: 'Mensa' },
        { id: 's3', label: 'Verde' },
    ];

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: '900',
                    color: Colors.primary,
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                }}
            >
                Storie di Impatto
            </Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
                {stories.map((story) => (
                    <View key={story.id} style={{ alignItems: 'center', width: 72 }}>
                        <View
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 36,
                                padding: 2.5,
                                marginBottom: 6,
                                backgroundColor: Colors.primary,
                            }}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    borderRadius: 34,
                                    backgroundColor: '#f1f5f9',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 22 }}>🏛️</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }} numberOfLines={1}>
                            {story.label}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

function CommunityPreview() {
    return (
        <View style={{ backgroundColor: '#f8fafc', borderRadius: 28, overflow: 'hidden', paddingVertical: 10 }}>
            <CommunityHero
                eyebrow="Persone vere"
                title="Entra. Guarda. Partecipa."
                subtitle="Storie, enti e momenti che fanno venire voglia di esserci."
                accent="#0f172a"
                accentSoft="rgba(255,255,255,0.12)"
                accentText="#0f172a"
                ctaLabel="Apri una storia che ti somiglia"
                onPress={() => {}}
            />
            <MiniStoriesRow />
            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 16,
                    borderRadius: 28,
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    paddingVertical: 16,
                }}
            >
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Voci dei volontari
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Cose viste da vicino.
                    </Text>
                </View>
                <CommunityCompactPostCard post={mockCommunityPost} />
            </View>
        </View>
    );
}

function OnboardingPreview() {
    return (
        <View style={{ flex: 1, backgroundColor: '#F8F9FB', borderRadius: 28, overflow: 'hidden', paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 }}>
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 5,
                        elevation: 2,
                    }}
                />
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#2D2D8A' }}>AiutarSì</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingTop: 30 }}>
                <View
                    style={{
                        width: 280,
                        height: 280,
                        borderRadius: 50,
                        overflow: 'hidden',
                        backgroundColor: '#E0E0E0',
                        marginBottom: 40,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.1,
                        shadowRadius: 20,
                        elevation: 5,
                    }}
                >
                    <Image
                        source={require('../../assets/images/gemma-intro.png')}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </View>

                <Text style={{ fontSize: 28, fontWeight: '900', color: '#1A1A40', textAlign: 'center', lineHeight: 34, marginBottom: 16 }}>
                    Ciao! Io sono <Text style={{ color: Colors.accent }}>Gemma</Text>, la tua assistente di bordo.
                </Text>
                <Text style={{ fontSize: 16, color: '#606080', textAlign: 'center', lineHeight: 24 }}>
                    Ti aiuterò a trovare il modo migliore per fare la differenza oggi.
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26 }}>
                    <View style={{ width: 32, height: 8, borderRadius: 4, backgroundColor: '#352F8B' }} />
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D1E0' }} />
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D1E0' }} />
                </View>

                <TouchableOpacity
                    activeOpacity={1}
                    style={{
                        marginTop: 34,
                        backgroundColor: '#352F8B',
                        height: 70,
                        borderRadius: 35,
                        width: '100%',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#352F8B',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 15,
                        elevation: 10,
                    }}
                >
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Inizia</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const mockNotifications = [
    {
        id: 'n1',
        type: 'INFO',
        title: 'Nuovo messaggio da Croce Verde',
        message: 'Hai ricevuto una risposta alla tua candidatura.',
        timestamp: new Date().toISOString(),
        read: false,
    },
    {
        id: 'n2',
        type: 'ACTIVITY_UPDATE',
        title: 'Attività aggiornata',
        message: 'Distribuzione pasti spostata alle 18:30.',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        read: true,
    },
    {
        id: 'n3',
        type: 'URGENT',
        title: 'Promemoria',
        message: 'Domani inizia il tuo turno alle 09:00.',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        read: true,
    },
] as const;

function getNotificationIcon(type: string, title?: string) {
    switch (type) {
        case 'ACTIVITY_UPDATE':
            return { Icon: AlertCircle, color: Colors.accent };
        case 'SUCCESS':
            return { Icon: CheckCircle, color: '#22c55e' };
        case 'URGENT':
            return { Icon: Bell, color: '#ef4444' };
        case 'INFO':
            if (title?.startsWith('Nuovo messaggio da')) {
                return { Icon: MessageCircle, color: Colors.primary };
            }
            return { Icon: Info, color: Colors.accent };
        default:
            return { Icon: Info, color: Colors.accent };
    }
}

function NotificationsPreview() {
    return (
        <View style={{ backgroundColor: '#ffffff', borderRadius: 28, overflow: 'hidden' }}>
            <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                    In Tempo Reale
                </Text>
                <Text style={{ color: 'white', fontSize: 26, fontWeight: '900', marginTop: 4 }}>
                    Le tue Notifiche
                </Text>
            </View>
            <View style={{ padding: 16 }}>
                {mockNotifications.map((notif) => {
                    const { Icon, color } = getNotificationIcon(notif.type, notif.title);
                    return (
                        <View
                            key={notif.id}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: 16,
                                padding: 16,
                                marginBottom: 14,
                                borderWidth: 1,
                                borderColor: notif.read ? '#e2e8f0' : '#f3d3e8',
                                opacity: notif.read ? 0.7 : 1,
                                flexDirection: 'row',
                                gap: 14,
                            }}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${color}10`, alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={20} color={color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '700', color: Colors.primary, fontSize: 14 }}>{notif.title}</Text>
                                <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 18, marginTop: 4 }}>{notif.message}</Text>
                                {!notif.read ? (
                                    <View style={{ marginTop: 10 }}>
                                        <View style={{ backgroundColor: '#fce7f3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
                                            <Text style={{ color: Colors.accent, fontWeight: '800', fontSize: 10 }}>NUOVA</Text>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

export function MarketingFramePreview({ preview }: MarketingFramePreviewProps) {
    if (preview === 'community_gemma') return <CommunityPreview />;
    if (preview === 'onboarding_intro') return <OnboardingPreview />;
    return <NotificationsPreview />;
}
