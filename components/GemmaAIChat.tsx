import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Image,
    SafeAreaView,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    Easing,
} from 'react-native-reanimated';
import { X, Send } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { supabase } from '../utils/supabase';

interface Message {
    role: 'user' | 'model';
    text: string;
    isTyping?: boolean;
}

interface GemmaAIChatProps {
    visible: boolean;
    onClose: () => void;
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
    }, []);

    const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
    const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
    const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary + 'aa' }, s1]} />
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary + 'aa' }, s2]} />
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary + 'aa' }, s3]} />
        </View>
    );
};

export const GemmaAIChat: React.FC<GemmaAIChatProps> = ({ visible, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Ciao! Sono Gemma 👋 Il mio database di conoscenze è aggiornato al 18 Marzo 2026. Posso rispondere solo a domande su AiutarSì. Come posso aiutarti?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    // Typing effect for model responses
    const typeMessage = useCallback((fullText: string, index: number) => {
        let charIndex = 0;
        const interval = setInterval(() => {
            charIndex++;
            setMessages(prev => {
                const updated = [...prev];
                if (updated[index]) {
                    updated[index] = { ...updated[index], text: fullText.slice(0, charIndex), isTyping: charIndex < fullText.length };
                }
                return updated;
            });
            scrollRef.current?.scrollToEnd({ animated: false });
            if (charIndex >= fullText.length) clearInterval(interval);
        }, 18); // ~18ms per char ≈ very fast typing feel
        return interval;
    }, []);

    const sendMessage = async () => {
        const question = input.trim();
        if (!question || isLoading) return;

        setInput('');
        setIsLoading(true);

        // Add user message
        const userMsg: Message = { role: 'user', text: question };
        const placeholderIndex = messages.length + 1;

        setMessages(prev => [
            ...prev,
            userMsg,
            { role: 'model', text: '', isTyping: true }
        ]);

        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            // Build history excluding initial greeting (index 0)
            const history = messages
                .slice(1) // skip greeting
                .map(m => ({
                    role: m.role,
                    parts: [{ text: m.text }],
                }));

            const { data, error } = await supabase.functions.invoke('gemma-help-assistant', {
                body: { question, history },
            });

            const answer = data?.answer || 'Mi dispiace, ho avuto un problema. Riprova!';

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
                    setIsLoading(false);
                }
            }, 18);

        } catch (err) {
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]) {
                    updated[lastIdx] = { role: 'model', text: 'Errore di connessione. Riprova tra poco! 🔌', isTyping: false };
                }
                return updated;
            });
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent={true}>
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
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
                    paddingTop: 20,
                    paddingBottom: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f1f5f9',
                    gap: 12,
                }}>
                    <Image
                        source={require('../assets/images/gemma_avatar.png')}
                        style={{ width: 44, height: 44, borderRadius: 22 }}
                        resizeMode="contain"
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>Chiedi a Gemma</Text>
                        <Text style={{ fontSize: 12, color: Colors.secondary }}>Assistente AiutarSì · Solo argomenti app</Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 20, padding: 8 }}
                    >
                        <X size={20} color={Colors.secondary} />
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
                                    <Image
                                        source={require('../assets/images/gemma_avatar.png')}
                                        style={{ width: 28, height: 28, borderRadius: 14, marginBottom: 4 }}
                                        resizeMode="contain"
                                    />
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
                                            <Text style={{ fontSize: 15, color: Colors.primary, lineHeight: 22 }}>
                                                {msg.text}
                                                {msg.isTyping && <Text style={{ color: Colors.primary }}>▍</Text>}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                            {msg.role === 'user' && (
                                <View style={{
                                    backgroundColor: Colors.primary,
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
                            color: Colors.primary,
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
                            backgroundColor: input.trim() && !isLoading ? Colors.primary : '#e2e8f0',
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
