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
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#f8f7ff',
                    borderRadius: 22,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: '#ddd6fe',
                }}
            >
                <View style={{ width: 34 }}>
                    <GemmaAvatar size={34} bordered />
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 10,
                            fontWeight: '900',
                            color: '#6366f1',
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            marginBottom: 2,
                        }}
                    >
                        {eyebrow}
                    </Text>
                    <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 17, color: '#475569', fontWeight: '700' }}>
                        {message}
                    </Text>
                </View>
                {ctaLabel ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.primary }}>
                            {ctaLabel}
                        </Text>
                        <ChevronRight size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
                    </View>
                ) : null}
            </TouchableOpacity>
        </View>
    );
}
