import { Stack, useSegments } from "expo-router";
import { View, StyleSheet, Dimensions } from "react-native";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

const { width } = Dimensions.get("window");

export default function OnboardingLayout() {
    const { user } = useAuth();
    const segments = useSegments();
    const insets = useSafeAreaInsets();
    const currentPath = segments[segments.length - 1];

    const isNPO = user?.role === "NPO";

    // Define steps for each flow
    const volunteerSteps = ["intro", "interests", "skills", "profile", "welcome"];
    const npoSteps = [
        "intro",
        "npo-category",
        "npo-skills",
        "npo-details",
        "npo-referent",
        "npo-verification",
        "npo-preview",
        "welcome"
    ];

    const steps = isNPO ? npoSteps : volunteerSteps;
    const currentIndex = steps.indexOf(currentPath);
    const progress = currentIndex >= 0 ? (currentIndex + 1) / steps.length : 0;

    const progressStyle = useAnimatedStyle(() => ({
        width: withSpring(width * progress, { damping: 20, stiffness: 90 }),
    }));

    return (
        <View style={styles.container}>
            {currentIndex >= 0 && currentPath !== "welcome" && (
                <View style={[styles.progressContainer, { top: insets.top }]}>
                    <Animated.View style={[styles.progressBar, progressStyle]} />
                </View>
            )}
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.background },
                }}
            >
                {/* Common */}
                <Stack.Screen name="intro" />
                <Stack.Screen name="welcome" />

                {/* Volunteer Only */}
                <Stack.Screen name="interests" />
                <Stack.Screen name="skills" />
                <Stack.Screen name="profile" />

                {/* NPO Only */}
                <Stack.Screen name="npo-category" />
                <Stack.Screen name="npo-skills" />
                <Stack.Screen name="npo-details" />
                <Stack.Screen name="npo-referent" />
                <Stack.Screen name="npo-verification" />
                <Stack.Screen name="npo-preview" />
            </Stack>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    progressContainer: {
        height: 6,
        backgroundColor: "#E2E8F0",
        width: "100%",
        position: "absolute",
        zIndex: 100,
    },
    progressBar: {
        height: "100%",
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
        borderTopRightRadius: 4,
    },
});
