import { View, TouchableOpacity } from "react-native";
import { colors, radius, shadows } from "@/theme";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: object;
  onPress?: () => void;
  variant?: "elevated" | "flat" | "outlined";
}

export function Card({ children, className, style, onPress, variant = "elevated" }: CardProps) {
  const Container = onPress ? TouchableOpacity : View;

  const variantStyle =
    variant === "flat"
      ? { borderRadius: radius.card }
      : variant === "outlined"
      ? { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border }
      : { borderRadius: radius.card, ...shadows.card() };

  return (
    <Container
      onPress={onPress}
      className={`bg-surface p-5 ${className ?? ""}`}
      style={[variantStyle, style]}
    >
      {children}
    </Container>
  );
}
