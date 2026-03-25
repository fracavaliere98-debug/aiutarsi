import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { GemmaAvatar } from '../GemmaAvatar';

interface GemmaFloatingHintProps {
    eyebrow?: string;
    message: string;
    ctaLabel?: string;
    onPress?: () => void;
}

export function GemmaFloatingHint({
    eyebrow = 'Gemma',
    message,
    ctaLabel,
    onPress,
}: GemmaFloatingHintProps) {
    return (
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity
                activeOpacity={onPress ? 0.92 : 1}
                onPress={onPress}
                disabled={!onPress}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
            >
                <View style={{ width: 40, paddingTop: 2 }}>
                    <GemmaAvatar size={34} bordered />
                </View>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: '#fcfcff',
                        borderRadius: 24,
                        borderTopLeftRadius: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        borderWidth: 1,
                        borderColor: '#dbe4ff',
                        shadowColor: '#312e81',
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 2,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: '900',
                            color: '#6366f1',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                        }}
                    >
                        {eyebrow}
                    </Text>
                    <Text style={{ fontSize: 13, lineHeight: 19, color: '#475569', fontWeight: '700' }}>
                        {message}
                    </Text>
                    {ctaLabel ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary }}>
                                {ctaLabel}
                            </Text>
                            <ChevronRight size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        </View>
    );
}
