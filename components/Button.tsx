import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { styled } from "nativewind";
import { colors } from "@/theme";

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "accent" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

const SIZE_PADDING: Record<"sm" | "md" | "lg", string> = {
  sm: "py-2 px-4",
  md: "py-3 px-6",
  lg: "py-4 px-6",
};

const SIZE_TEXT: Record<"sm" | "md" | "lg", string> = {
  sm: "font-bold text-sm",
  md: "font-bold text-base",
  lg: "font-bold text-lg",
};

export const Button = ({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  isLoading,
  disabled,
  className,
  testID,
}: ButtonProps) => {
  const isDisabled = disabled || isLoading;

  let variantClass = "";
  if (!isDisabled) {
    if (variant === "primary") variantClass = "bg-primary";
    else if (variant === "accent") variantClass = "bg-accent";
    else variantClass = "bg-transparent border-2 border-primary";
  }

  const containerClass = `${SIZE_PADDING[size]} rounded-[24px] flex-row justify-center items-center active:opacity-90 shadow-sm ${variantClass} ${className ?? ""}`;

  const disabledBgStyle =
    isDisabled && variant !== "outline" ? { backgroundColor: colors.disabled } : undefined;

  const indicatorColor = isDisabled
    ? colors.disabledText
    : variant === "outline"
    ? colors.primary
    : colors.white;

  const textColor = isDisabled
    ? colors.disabledText
    : variant === "outline"
    ? colors.primary
    : colors.white;

  return (
    <StyledTouchableOpacity
      onPress={onPress}
      className={containerClass}
      style={disabledBgStyle}
      disabled={isDisabled}
      testID={testID}
    >
      {isLoading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <StyledText className={SIZE_TEXT[size]} style={{ color: textColor }}>
          {title}
        </StyledText>
      )}
    </StyledTouchableOpacity>
  );
};
