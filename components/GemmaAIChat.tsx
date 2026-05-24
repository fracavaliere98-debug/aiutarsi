import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { X, Send } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { profileRest } from '../utils/profileRest';
import { GemmaAvatar } from './GemmaAvatar';
import { useAuth } from '../context/AuthContext';
import { getFirstName } from '../utils/getFirstName';
import { authService } from '../services/AuthService';
import { buildContextAwareHelpAnswer, buildLocalHelpFallback, type LocalHelpContext } from '../utils/gemmaHelpLocal';
import { isExpectedUserInputError, trackError, trackEvent } from '../utils/monitoring';
import { colors } from "@/theme";

interface Message {
    role: 'user' | 'model';
    text: string;
    isTyping?: boolean;
}

interface GemmaAIChatProps {
    visible: boolean;
    onClose: () => void;
    mode?: 'help_center' | 'shadow';
    title?: string;
    subtitle?: string;
    initialMessage?: string;
}

async function loadLocalHelpContext(user: any, accessToken?: string): Promise<LocalHelpContext> {
    const userId = user?.id;
    const isVolunteer = user?.role === 'VOLUNTEER';
    const isNpo = user?.role === 'NPO';
    const [applications, followedRows, registeredRows, npoActivities, npoApplications] = await Promise.all([
        isVolunteer && userId ? profileRest.listApplicationsForVolunteer(userId, accessToken).catch(() => []) : Promise.resolve([]),
        isVolunteer && userId ? profileRest.listVolunteerFollowedNpos(userId, accessToken).catch(() => []) : Promise.resolve([]),
        isVolunteer && userId ? profileRest.listVolunteerRegisteredActivities(userId, accessToken).catch(() => []) : Promise.resolve([]),
        isNpo && userId ? profileRest.listNpoActivities(userId, accessToken).catch(() => []) : Promise.resolve([]),
        isNpo && userId ? profileRest.listApplicationsForNPO(userId, accessToken).catch(() => []) : Promise.resolve([]),
    ]);

    const followedIds = Array.from(new Set((followedRows || []).map((row) => row.npo_id).filter(Boolean)));
    const followedProfiles = followedIds.length
        ? await profileRest.getBasicProfiles(followedIds, accessToken).catch(() => [])
        : [];
    const followedMap = new Map((followedProfiles || []).map((profile) => [profile.id, profile.npo_name || profile.full_name || 'NPO']));
    const registeredNpoIds = Array.from(
        new Set((registeredRows || []).map((row: any) => row.activities?.npo_id).filter(Boolean))
    );
    const registeredNpoProfiles = registeredNpoIds.length
        ? await profileRest.getBasicProfiles(registeredNpoIds, accessToken).catch(() => [])
        : [];
    const registeredNpoMap = new Map(
        (registeredNpoProfiles || []).map((profile) => [profile.id, profile.npo_name || profile.full_name || 'NPO'])
    );

    return {
        profile: {
            displayName: user?.full_name || user?.name || user?.npo_name || 'Profilo',
            role: user?.role || null,
            bio: user?.bio || null,
            location: user?.location_string || user?.address_full || null,
            website: user?.website || user?.npo_website || null,
            npoName: user?.npo_name || null,
            skills: Array.isArray(user?.skills) ? user.skills.filter(Boolean) : [],
            interests: Array.isArray(user?.interests) ? user.interests.filter(Boolean) : [],
        },
        followedNpos: followedIds.map((id) => ({ id, name: followedMap.get(id) || 'NPO' })),
        pendingNpos: (applications || [])
            .filter((application: any) => application.status === 'PENDING')
            .map((application: any) => ({
                id: application.npo_id,
                name: application.npo?.npo_name || application.npo?.full_name || 'NPO',
            })),
        approvedNpos: (applications || [])
            .filter((application: any) => application.status === 'APPROVED')
            .map((application: any) => ({
                id: application.npo_id,
                name: application.npo?.npo_name || application.npo?.full_name || 'NPO',
            })),
        registeredActivities: (registeredRows || [])
            .map((row: any) => ({
                id: row.activities?.id || row.activity_id,
                title: row.activities?.title || 'Attività',
                dateStart: row.activities?.date_start,
                status: row.status,
                npoName: row.activities?.npo_id ? registeredNpoMap.get(row.activities.npo_id) : undefined,
            })),
        npoActivities: (npoActivities || []).map((activity: any) => ({
            id: activity.id,
            title: activity.title || 'Attività',
            status: activity.status,
        })),
        pendingVolunteers: (npoApplications || [])
            .filter((application: any) => application.status === 'PENDING')
            .map((application: any) => ({
                id: application.volunteer_id,
                name: application.volunteer?.full_name || application.volunteer?.name || 'Volontario',
            })),
        approvedVolunteers: (npoApplications || [])
            .filter((application: any) => application.status === 'APPROVED')
            .map((application: any) => ({
                id: application.volunteer_id,
                name: application.volunteer?.full_name || application.volunteer?.name || 'Volontario',
            })),
    };
}

// Typing dots animation component
const TypingDots = () => {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
        // Staggered timing via delays through sequential composition
        dot1.value = withRepeat(
            withSequence(
                withTiming(-5, { duration: 300 }),
                withTiming(0, { duration: 300 }),
                withTiming(0, { duration: 200 }),
            ),
            -1
        );
        dot2.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 200 }),
                withTiming(-5, { duration: 300 }),
                withTiming(0, { duration: 300 }),
            ),
            -1
        );
        dot3.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 400 }),
                withTiming(-5, { duration: 300 }),
                withTiming(0, { duration: 300 }),
            ),
            -1
        );
    }, [dot1, dot2, dot3]);

    const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
    const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
    const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary + 'aa' }, s1]} />
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary + 'aa' }, s2]} />
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary + 'aa' }, s3]} />
        </View>
    );
};

export const GemmaAIChat: React.FC<GemmaAIChatProps> = ({
    visible,
    onClose,
    mode = 'help_center',
    title = 'Chiedi a Gemma',
    subtitle = 'Assistente AiutarSì · Solo argomenti app',
    initialMessage = 'Ciao! Sono Gemma 👋 Posso aiutarti su funzionalità, regole e flussi di AiutarSì. Come posso aiutarti?'
}) => {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const requestSeqRef = useRef(0);
    const firstName = getFirstName(user?.full_name || user?.name);
    const resolvedInitialMessage = firstName
        ? `Ciao ${firstName}! Sono Gemma 👋 Posso aiutarti su funzionalità, regole e flussi di AiutarSì. Come posso aiutarti?`
        : initialMessage;
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: resolvedInitialMessage }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        setMessages([{ role: 'model', text: resolvedInitialMessage }]);
    }, [resolvedInitialMessage, visible]);

    useEffect(() => {
        console.log('[DEBUG] GemmaAIChat: visibility', {
            visible,
            mode,
            isLoading,
            messageCount: messages.length,
        });
    }, [visible, mode, isLoading, messages.length]);

    const sendMessage = async () => {
        const question = input.trim();
        if (!question || isLoading) return;
        const requestId = ++requestSeqRef.current;
        const startedAt = Date.now();
        console.log('[DEBUG] GemmaAIChat: send start', {
            requestId,
            mode,
            questionLength: question.length,
            messageCount: messages.length,
        });
        trackEvent("gemma_request_started", {
            mode,
            requestId,
            questionLength: question.length,
            role: user?.role || "anonymous",
        });

        setInput('');
        setIsLoading(true);

        // Add user message
        const userMsg: Message = { role: 'user', text: question };
        setMessages(prev => [
            ...prev,
            userMsg,
            { role: 'model', text: '', isTyping: true }
        ]);

        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const cachedAccessToken = authService.getCachedAccessToken();
            const accessToken = cachedAccessToken || (await supabase.auth.getSession()).data.session?.access_token;
            console.log('[DEBUG] GemmaAIChat: auth resolved', {
                requestId,
                tokenSource: cachedAccessToken ? 'cache' : 'session',
                hasAccessToken: !!accessToken,
                elapsedMs: Date.now() - startedAt,
            });

            if (mode === 'shadow' && !accessToken) {
                throw new Error('Sessione non valida. Effettua di nuovo l’accesso.');
            }

            // Build history excluding initial greeting (index 0)
            const history = messages
                .slice(1) // skip greeting
                .map(m => ({
                    role: m.role,
                    parts: [{ text: m.text }],
                }));
            console.log('[DEBUG] GemmaAIChat: payload prepared', {
                requestId,
                historyCount: history.length,
                elapsedMs: Date.now() - startedAt,
            });

            if (mode === 'help_center') {
                const localContext = user?.id
                    ? await loadLocalHelpContext(user, accessToken || undefined)
                    : {
                        profile: {
                            displayName: 'Profilo',
                            role: user?.role || null,
                            bio: null,
                            location: null,
                            website: null,
                            npoName: null,
                            skills: [],
                            interests: [],
                        },
                        followedNpos: [],
                        pendingNpos: [],
                        approvedNpos: [],
                        registeredActivities: [],
                        npoActivities: [],
                        pendingVolunteers: [],
                        approvedVolunteers: [],
                    };
                const recentUserQuestions = messages
                    .filter((message) => message.role === 'user')
                    .map((message) => message.text)
                    .filter(Boolean)
                    .slice(-2);
                const answer = buildContextAwareHelpAnswer(question, localContext, user?.role, recentUserQuestions);
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (updated[lastIdx]) {
                        updated[lastIdx] = {
                            role: 'model',
                            text: answer,
                            isTyping: false,
                        };
                    }
                    return updated;
                });
                scrollRef.current?.scrollToEnd({ animated: true });
                console.log('[DEBUG] GemmaAIChat: help_center local answer committed', {
                    requestId,
                    totalElapsedMs: Date.now() - startedAt,
                    followedNpos: localContext.followedNpos.length,
                    pendingNpos: localContext.pendingNpos.length,
                    approvedNpos: localContext.approvedNpos.length,
                    registeredActivities: localContext.registeredActivities.length,
                    npoActivities: localContext.npoActivities.length,
                    pendingVolunteers: localContext.pendingVolunteers.length,
                    approvedVolunteers: localContext.approvedVolunteers.length,
                });
                trackEvent("gemma_request_succeeded", {
                    mode,
                    requestId,
                    role: user?.role || "anonymous",
                    answerSource: "local_help",
                });
                setIsLoading(false);
                return;
            }

            const data = await profileRest.invokeGemmaHelpAssistant(
                { question, history, mode, role: user?.role || null },
                mode === 'shadow' ? accessToken || undefined : undefined,
                12000
            );
            console.log('[DEBUG] GemmaAIChat: response resolved', {
                requestId,
                hasData: !!data,
                dataKeys: data ? Object.keys(data) : [],
                elapsedMs: Date.now() - startedAt,
            });
            const answer = data?.answer || 'Mi dispiace, ho avuto un problema. Riprova!';
            console.log('[DEBUG] GemmaAIChat: answer ready', {
                requestId,
                answerLength: answer.length,
                elapsedMs: Date.now() - startedAt,
            });

            // Replace placeholder with typed text
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isTyping) {
                    updated[lastIdx] = { role: 'model', text: '', isTyping: true };
                }
                return updated;
            });

            // Trigger typing animation
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]) {
                    updated[lastIdx] = { role: 'model', text: '', isTyping: true };
                }
                return updated;
            });

            let charIndex = 0;
            const interval = setInterval(() => {
                charIndex++;
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (updated[lastIdx]) {
                        updated[lastIdx] = {
                            role: 'model',
                            text: answer.slice(0, charIndex),
                            isTyping: charIndex < answer.length,
                        };
                    }
                    return updated;
                });
                scrollRef.current?.scrollToEnd({ animated: false });
                if (charIndex >= answer.length) {
                    clearInterval(interval);
                    console.log('[DEBUG] GemmaAIChat: typing done', {
                        requestId,
                        totalElapsedMs: Date.now() - startedAt,
                    });
                    trackEvent("gemma_request_succeeded", {
                        mode,
                        requestId,
                        role: user?.role || "anonymous",
                        answerSource: "remote",
                    });
                    setIsLoading(false);
                }
            }, 18);

        } catch (error: any) {
            console.error('[GemmaAIChat] invoke failed:', error);
            console.log('[DEBUG] GemmaAIChat: invoke failed detail', {
                requestId,
                error: error?.message || String(error),
                elapsedMs: Date.now() - startedAt,
            });
            const expected = mode === "help_center" && isExpectedUserInputError(error);
            trackError(error, {
                source: "gemma_chat",
                mode,
                requestId,
                questionLength: question.length,
                role: user?.role || "anonymous",
            }, {
                source: "gemma_chat",
                priority: expected ? "low" : (mode === "shadow" ? "high" : "normal"),
                classification: expected
                    ? "expected_user"
                    : (mode === "shadow" ? "error_technical" : "warning_functional"),
                issueName: mode === "shadow" ? "gemma_shadow_failed" : "gemma_help_failed",
                expected,
            });
            const fallbackMessage =
                mode === 'help_center'
                    ? buildLocalHelpFallback(question, user?.role)
                    : (error?.message && typeof error.message === 'string'
                        ? `Errore Gemma: ${error.message}`
                        : 'Errore di connessione. Riprova tra poco! 🔌');
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]) {
                    updated[lastIdx] = { role: 'model', text: fallbackMessage, isTyping: false };
                }
                return updated;
            });
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent={true}>
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                {/* Header */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingTop: Math.max(insets.top, 16) + 8,
                    paddingBottom: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f1f5f9',
                    gap: 12,
                }}>
                    <GemmaAvatar size={44} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary }}>{title}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{subtitle}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 20, padding: 8 }}
                    >
                        <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((msg, i) => (
                        <View
                            key={i}
                            style={{
                                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: 8,
                            }}
                        >
                            {msg.role === 'model' && (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%' }}>
                                    <GemmaAvatar size={28} style={{ marginBottom: 4 }} />
                                    <View style={{
                                        backgroundColor: '#f8f4ff',
                                        borderRadius: 18,
                                        borderTopLeftRadius: 4,
                                        padding: 12,
                                        maxWidth: '100%',
                                    }}>
                                        {msg.isTyping && msg.text === '' ? (
                                            <TypingDots />
                                        ) : (
                                            <Text style={{ fontSize: 15, color: colors.primary, lineHeight: 22 }}>
                                                {msg.text}
                                                {msg.isTyping && <Text style={{ color: colors.primary }}>▍</Text>}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                            {msg.role === 'user' && (
                                <View style={{
                                    backgroundColor: colors.primary,
                                    borderRadius: 18,
                                    borderTopRightRadius: 4,
                                    padding: 12,
                                    maxWidth: '80%',
                                }}>
                                    <Text style={{ fontSize: 15, color: 'white', lineHeight: 22 }}>{msg.text}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>

                {/* Input */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: '#f1f5f9',
                    gap: 10,
                }}>
                    <TextInput
                        style={{
                            flex: 1,
                            backgroundColor: '#f8f9fa',
                            borderRadius: 22,
                            paddingHorizontal: 18,
                            paddingVertical: 12,
                            fontSize: 15,
                            color: colors.primary,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            maxHeight: 100,
                        }}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Scrivi una domanda..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        returnKeyType="send"
                        onSubmitEditing={sendMessage}
                        editable={!isLoading}
                    />
                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={!input.trim() || isLoading}
                        style={{
                            backgroundColor: input.trim() && !isLoading ? colors.primary : '#e2e8f0',
                            borderRadius: 22,
                            padding: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Send size={20} color={input.trim() && !isLoading ? 'white' : '#9ca3af'} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};
