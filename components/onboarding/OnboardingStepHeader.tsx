import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

type OnboardingStepHeaderProps = {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    onClose?: () => void;
    closeLabel?: string;
    compact?: boolean;
};

export function OnboardingStepHeader({
    title,
    subtitle,
    onBack,
    onClose,
    closeLabel = 'Esci',
    compact = false,
}: OnboardingStepHeaderProps) {
    return (
        <View style={{ paddingHorizontal: 24, paddingTop: compact ? 8 : 12, paddingBottom: compact ? 12 : 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <TouchableOpacity
                    onPress={onBack}
                    disabled={!onBack}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#ffffff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#ede9fe',
                        opacity: onBack ? 1 : 0,
                    }}
                >
                    <ArrowLeft size={20} color={Colors.primary} />
                </TouchableOpacity>

                {onClose ? (
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            minWidth: 40,
                            height: 40,
                            borderRadius: 20,
                            paddingHorizontal: 12,
                            backgroundColor: '#ffffff',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#ede9fe',
                            flexDirection: 'row',
                            gap: 6,
                        }}
                    >
                        <X size={16} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>{closeLabel}</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40, opacity: 0 }} />
                )}
            </View>

            <Text style={{ fontSize: compact ? 26 : 30, lineHeight: compact ? 32 : 36, fontWeight: '900', color: Colors.primary, marginBottom: subtitle ? 8 : 0 }}>
                {title}
            </Text>
            {!!subtitle && (
                <Text style={{ fontSize: 14, lineHeight: 21, color: Colors.secondary }}>
                    {subtitle}
                </Text>
            )}
        </View>
    );
}
