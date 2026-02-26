import { View, Text, TouchableOpacity } from "react-native";
import { styled } from "nativewind";

// Use styled to wrap View/TouchableOpacity if needed, but here we pass className prop directly
// which NativeWind handles if configured correctly. 
// However, to be safe with custom components, simple view wrapping is fine.

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onPress?: () => void;
}

export function Card({ children, className, onPress }: CardProps) {
    const Container = onPress ? TouchableOpacity : View;
    return (
        <Container
            onPress={onPress}
            // Changed rounded-2xl to rounded-[32px] (approx 3xl) for very round look
            className={`bg-white rounded-[32px] p-5 shadow-sm border border-primary/5 ${className}`}
        >
            {children}
        </Container>
    );
}
