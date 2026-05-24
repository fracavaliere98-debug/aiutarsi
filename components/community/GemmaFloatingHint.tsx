import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { GemmaAvatar } from '../GemmaAvatar';
import { colors, palette, radius, spacing } from "@/theme";

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
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <TouchableOpacity
                activeOpacity={onPress ? 0.92 : 1}
                onPress={onPress}
                disabled={!onPress}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: palette.purple50,
                    borderRadius: radius["2xl"],
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: palette.purple100,
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
                            color: palette.blue400,
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            marginBottom: 2,
                        }}
                    >
                        {eyebrow}
                    </Text>
                    <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 17, color: palette.slate600, fontWeight: '700' }}>
                        {message}
                    </Text>
                </View>
                {ctaLabel ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary }}>
                            {ctaLabel}
                        </Text>
                        <ChevronRight size={14} color={colors.primary} style={{ marginLeft: 2 }} />
                    </View>
                ) : null}
            </TouchableOpacity>
        </View>
    );
}
