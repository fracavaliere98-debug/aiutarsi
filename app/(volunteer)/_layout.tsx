import { Stack } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Colors } from "../../constants/Colors";

export default function VolunteerStackLayout() {
    const { user, isLoading } = useAuth();

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            <Stack.Screen name="interests-skills" options={{ presentation: 'card' }} />
        </Stack>
    );
}
