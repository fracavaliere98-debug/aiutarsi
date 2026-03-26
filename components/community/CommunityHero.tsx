import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ArrowRight, X } from 'lucide-react-native';

type CommunityHeroStat = {
    label: string;
    value: string;
};

interface CommunityHeroProps {
    eyebrow: string;
    title: string;
    subtitle: string;
    accent: string;
    accentSoft: string;
    accentText: string;
    ctaLabel: string;
    onPress: () => void;
    badgeLabel?: string;
    onClose?: () => void;
    secondaryLabel?: string;
    secondaryValue?: string;
    stats?: CommunityHeroStat[];
}

export function CommunityHero({
    eyebrow,
    title,
    subtitle,
    accent,
    accentSoft,
    accentText,
    ctaLabel,
    onPress,
    badgeLabel,
    onClose,
    secondaryLabel,
    secondaryValue,
    stats = [],
}: CommunityHeroProps) {
    return (
        <View
            style={{
                marginHorizontal: 16,
                marginTop: 4,
                marginBottom: 20,
                borderRadius: 30,
                overflow: 'hidden',
                backgroundColor: accent,
            }}
        >
            <View
                style={{
                    position: 'absolute',
                    top: -30,
                    right: -10,
                    width: 150,
                    height: 150,
                    borderRadius: 75,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    bottom: -45,
                    left: -15,
                    width: 170,
                    height: 170,
                    borderRadius: 85,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                }}
            />
            <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    {badgeLabel ? (
                        <View
                            style={{
                                alignSelf: 'flex-start',
                                backgroundColor: 'rgba(255,255,255,0.14)',
                                borderRadius: 999,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.16)',
                            }}
                        >
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                {badgeLabel}
                            </Text>
                        </View>
                    ) : <View />}

                    {onClose ? (
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255,255,255,0.14)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.16)',
                            }}
                        >
                            <X size={16} color="white" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                        <Text
                            style={{
                                color: 'rgba(255,255,255,0.76)',
                                fontSize: 11,
                                fontWeight: '900',
                                textTransform: 'uppercase',
                                letterSpacing: 0.8,
                                marginBottom: 8,
                            }}
                        >
                            {eyebrow}
                        </Text>
                        <Text
                            style={{
                                color: 'white',
                                fontSize: 28,
                                lineHeight: 32,
                                fontWeight: '900',
                                marginBottom: 10,
                            }}
                        >
                            {title}
                        </Text>
                        <Text
                            style={{
                                color: 'rgba(255,255,255,0.82)',
                                fontSize: 14,
                                lineHeight: 21,
                                marginBottom: 18,
                            }}
                        >
                            {subtitle}
                        </Text>
                    </View>

                    {secondaryLabel && secondaryValue ? (
                        <View
                            style={{
                                minWidth: 92,
                                borderRadius: 22,
                                paddingHorizontal: 14,
                                paddingVertical: 14,
                                backgroundColor: 'rgba(255,255,255,0.14)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.18)',
                            }}
                        >
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                {secondaryLabel}
                            </Text>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                                {secondaryValue}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={onPress}
                    style={{
                        alignSelf: 'flex-start',
                        backgroundColor: 'white',
                        borderRadius: 999,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <Text style={{ color: accentText, fontSize: 13, fontWeight: '900' }}>{ctaLabel}</Text>
                    <ArrowRight size={15} color={accentText} />
                </TouchableOpacity>

                {stats.length > 0 ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                        {stats.map((stat) => (
                            <View
                                key={stat.label}
                                style={{
                                    flex: 1,
                                    backgroundColor: accentSoft,
                                    borderRadius: 20,
                                    paddingHorizontal: 14,
                                    paddingVertical: 14,
                                }}
                            >
                                <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                    {stat.label}
                                </Text>
                                <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginTop: 4 }}>
                                    {stat.value}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}
