import { Stack } from "expo-router";
import { Colors } from "../../constants/Colors";

export default function OnboardingLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.background },
            }}
        >
            <Stack.Screen name="interests" />
            <Stack.Screen name="skills" />
            <Stack.Screen name="verification" />
            <Stack.Screen name="profile" />
        </Stack>
    );
}
