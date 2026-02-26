import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

interface EmptyStateProps {
    icon?: any;
    emoji?: string;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    emoji,
    title,
    description,
    actionLabel,
    onAction,
}) => {
    // Assuming resolvedIconColor should be Colors.accent based on the original code
    const resolvedIconColor = Colors.accent;

    return (
        <View className="flex-1 items-center justify-center px-8 py-12">
            {emoji ? (
                <Text className="text-7xl mb-6">{emoji}</Text>
            ) : (
                <View className="bg-indigo-50 rounded-full p-6 mb-6">
                    {Icon && <Icon size={64} color={resolvedIconColor} strokeWidth={1.5} />}
                </View>
            )}

            <Text className="text-primary font-black text-xl text-center mb-2">
                {title}
            </Text>

            {description && (
                <Text className="text-secondary text-center text-sm mb-6 leading-relaxed">
                    {description}
                </Text>
            )}

            {actionLabel && onAction && (
                <TouchableOpacity
                    onPress={onAction}
                    className="bg-accent px-6 py-3 rounded-2xl shadow-sm"
                >
                    <Text className="text-white font-bold text-sm">
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
