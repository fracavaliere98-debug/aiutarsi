import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    LayoutAnimation,
    Platform,
    UIManager,
    Image,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, LifeBuoy } from 'lucide-react-native';
import { StandardLayout } from '../components/StandardLayout';
import { SoftCard } from '../components/SoftCard';
import { Colors } from '../constants/Colors';
import { GemmaAIChat } from '../components/GemmaAIChat';
import { supabase } from '../utils/supabase';
import { FAQ, GuideSection, GUIDE_SECTIONS } from '../shared/helpCenterContent';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Accordion FAQ item
const FAQItem = ({ faq, isOpen, onToggle, onFeedback }: {
    faq: FAQ;
    isOpen: boolean;
    onToggle: () => void;
    onFeedback: (id: string, val: 'up' | 'down') => void;
}) => {
    const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

    const handleFeedback = (val: 'up' | 'down') => {
        setFeedbackGiven(val);
        onFeedback(faq.id, val);
    };

    return (
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <TouchableOpacity
                onPress={onToggle}
                activeOpacity={0.7}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    gap: 12,
                }}
            >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: Colors.primary, lineHeight: 21 }}>
                    {faq.question}
                </Text>
                {isOpen ? (
                    <ChevronUp size={18} color={Colors.accent} />
                ) : (
                    <ChevronDown size={18} color={Colors.secondary} />
                )}
            </TouchableOpacity>

            {isOpen && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: Colors.secondary, lineHeight: 22 }}>{faq.answer}</Text>

                    {/* Thumbs feedback */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 12,
                        gap: 8,
                    }}>
                        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600' }}>
                            Questa guida ti ha aiutato?
                        </Text>
                        <TouchableOpacity
                            onPress={() => handleFeedback('up')}
                            style={{
                                padding: 6,
                                borderRadius: 20,
                                backgroundColor: feedbackGiven === 'up' ? '#dcfce7' : '#f1f5f9',
                            }}
                            disabled={feedbackGiven !== null}
                        >
                            <ThumbsUp size={14} color={feedbackGiven === 'up' ? '#16a34a' : '#9ca3af'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleFeedback('down')}
                            style={{
                                padding: 6,
                                borderRadius: 20,
                                backgroundColor: feedbackGiven === 'down' ? '#fee2e2' : '#f1f5f9',
                            }}
                            disabled={feedbackGiven !== null}
                        >
                            <ThumbsDown size={14} color={feedbackGiven === 'down' ? '#dc2626' : '#9ca3af'} />
                        </TouchableOpacity>
                        {feedbackGiven && (
                            <Text style={{ fontSize: 11, color: feedbackGiven === 'up' ? '#16a34a' : '#dc2626', fontWeight: '700' }}>
                                {feedbackGiven === 'up' ? 'Grazie! 🎉' : 'Grazie, miglioreremo!'}
                            </Text>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

// Accordion section
const GuideSectionCard = ({ section }: { section: GuideSection }) => {
    const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());

    const toggleFaq = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenFaqs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleFeedback = async (faqId: string, val: 'up' | 'down') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('faq_feedback').insert({
                faq_id: faqId,
                section_id: section.id,
                faq_question: section.faqs.find(f => f.id === faqId)?.question || faqId,
                vote: val,
                user_id: user?.id || null,
            });
            console.log(`Feedback [${val}] saved for FAQ: ${section.id}/${faqId}`);
        } catch (error) {
            console.error('Error saving FAQ feedback:', error);
        }
    };

    return (
        <SoftCard style={{ marginBottom: 16, overflow: 'hidden' }}>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
                gap: 10,
            }}>
                <Text style={{ fontSize: 22 }}>{section.emoji}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary }}>{section.title}</Text>
            </View>
            {section.faqs.map((faq) => (
                <FAQItem
                    key={faq.id}
                    faq={faq}
                    isOpen={openFaqs.has(faq.id)}
                    onToggle={() => toggleFaq(faq.id)}
                    onFeedback={handleFeedback}
                />
            ))}
        </SoftCard>
    );
};

// Floating Gemma Button with breathing animation
const GemmaFloatingButton = ({ onPress }: { onPress: () => void }) => {
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.06, { duration: 900 }),
                withTiming(1, { duration: 900 }),
            ),
            -1,
            false
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[
            {
                position: 'absolute',
                bottom: 24,
                right: 20,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 10,
                borderRadius: 40,
            },
            animStyle,
        ]}>
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: Colors.primary,
                    borderRadius: 40,
                    paddingVertical: 10,
                    paddingLeft: 10,
                    paddingRight: 16,
                    gap: 8,
                }}
            >
                <Image
                    source={require('../assets/images/gemma_avatar.png')}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#7c3aed20' }}
                    resizeMode="contain"
                />
                <View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: 'white' }}>Chiedi a Gemma</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Assistente AI</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function HelpCenterScreen() {
    const router = useRouter();
    const [chatVisible, setChatVisible] = useState(false);

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <StandardLayout
                label="Supporto"
                title="Centro Assistenza"
                onBack={() => router.back()}
            >
                {/* Intro Banner */}
                <View style={{
                    backgroundColor: Colors.primary + '0d',
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 24,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                }}>
                    <View style={{
                        backgroundColor: Colors.primary + '15',
                        borderRadius: 24,
                        padding: 10,
                    }}>
                        <LifeBuoy size={28} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.primary, marginBottom: 2 }}>
                            Come possiamo aiutarti?
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.secondary, lineHeight: 17 }}>
                            Sfoglia le guide qui sotto o chiedi direttamente a Gemma, il nostro assistente AI.
                        </Text>
                    </View>
                </View>

                {/* Guide Sections */}
                {GUIDE_SECTIONS.map((section) => (
                    <GuideSectionCard key={section.id} section={section} />
                ))}

                {/* Bottom spacer for floating button */}
                <View style={{ height: 90 }} />
            </StandardLayout>

            {/* Floating Gemma Button */}
            <GemmaFloatingButton onPress={() => setChatVisible(true)} />

            {/* Gemma AI Chat Modal */}
            <GemmaAIChat
                visible={chatVisible}
                onClose={() => setChatVisible(false)}
                mode="help_center"
                title="Chiedi a Gemma"
                subtitle="Assistente AiutarSì · Centro Assistenza"
            />
        </View>
    );
}
