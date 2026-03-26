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
            <View
                style={[
                    styles.glow,
                    {
                        width: size,
                        height: size,
                        borderRadius,
                    },
                ]}
            />
            <Image
                source={require("../assets/images/gemma_avatar.png")}
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
        backgroundColor: "#efe7ff",
        shadowColor: "#7c3aed",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255,255,255,0.18)",
    },
});
