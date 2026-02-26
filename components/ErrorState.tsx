import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LucideIcon, AlertCircle, RefreshCw } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

interface ErrorStateProps {
    icon?: LucideIcon;
    title?: string;
    description?: string;
    onRetry?: () => void;
    retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    icon: Icon = AlertCircle,
    title = "Si è verificato un errore",
    description = "Non siamo riusciti a caricare i dati richiesti. Riprova tra poco.",
    onRetry,
    retryLabel = "Riprova",
}) => {
    return (
        <View className="flex-1 items-center justify-center px-8 py-12">
            <View className="bg-red-50 rounded-full p-6 mb-6">
                <Icon size={48} color="#ef4444" />
            </View>

            <Text className="text-primary font-black text-xl text-center mb-2">
                {title}
            </Text>

            <Text className="text-secondary text-center text-sm mb-8 leading-relaxed">
                {description}
            </Text>

            {onRetry && (
                <TouchableOpacity
                    onPress={onRetry}
                    className="bg-primary flex-row items-center gap-2 px-8 py-4 rounded-2xl shadow-sm active:scale-95"
                >
                    <RefreshCw size={18} color="white" />
                    <Text className="text-white font-bold text-base">
                        {retryLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
