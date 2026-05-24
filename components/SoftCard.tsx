import { View, TouchableOpacity, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { ReactNode } from "react";
import { useCardPressAnimation } from "../hooks/useCardAnimation";
import { colors, radius, shadows } from "@/theme";

interface SoftCardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const tokenStyle = {
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.borderMuted,
  ...shadows.softCard,
} as const;

export function SoftCard({ children, className = "", onPress, style, testID }: SoftCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = useCardPressAnimation();

  if (onPress) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          className={`bg-surface ${className}`}
          style={[tokenStyle, style]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.9}
          testID={testID}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View className={`bg-surface ${className}`} style={[tokenStyle, style]} testID={testID}>
      {children}
    </View>
  );
}
