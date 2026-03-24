import { Image, ImageStyle, StyleProp, StyleSheet, View } from "react-native";

interface GemmaAvatarProps {
    size?: number;
    bordered?: boolean;
    style?: StyleProp<ImageStyle>;
}

export function GemmaAvatar({ size = 32, bordered = false, style }: GemmaAvatarProps) {
    const borderRadius = size / 2;

    return (
        <View
            style={[
                styles.wrap,
                {
                    width: size,
                    height: size,
                    borderRadius,
                    borderWidth: bordered ? 1.5 : 0,
                },
            ]}
        >
            <Image
                source={require("../assets/images/gemma-intro.png")}
                style={[
                    {
                        width: size,
                        height: size,
                        borderRadius,
                    },
                    style,
                ]}
                resizeMode="cover"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        overflow: "hidden",
        borderColor: "rgba(255,255,255,0.35)",
        backgroundColor: "rgba(124,58,237,0.08)",
    },
});
