import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { styled } from "nativewind";

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: "primary" | "accent" | "outline";
    isLoading?: boolean;
    className?: string;
    testID?: string;
}

export const Button = ({ title, onPress, variant = "primary", isLoading, className, testID }: ButtonProps) => {
    // Increased rounding to rounded-[24px]
    let baseStyle = "py-4 px-6 rounded-[24px] flex-row justify-center items-center active:opacity-90 shadow-sm";
    let textStyle = "font-bold text-lg";

    if (variant === "primary") {
        baseStyle += " bg-primary";
        textStyle += " text-white";
    } else if (variant === "accent") {
        baseStyle += " bg-accent";
        textStyle += " text-white";
    } else {
        baseStyle += " bg-transparent border-2 border-primary";
        textStyle += " text-primary";
    }

    return (
        <StyledTouchableOpacity 
            onPress={onPress} 
            className={`${baseStyle} ${className}`} 
            disabled={isLoading}
            testID={testID}
        >
            {isLoading ? (
                <ActivityIndicator color={variant === "outline" ? "#462282" : "#ffffff"} />
            ) : (
                <StyledText className={textStyle}>{title}</StyledText>
            )}
        </StyledTouchableOpacity>
    );
};
