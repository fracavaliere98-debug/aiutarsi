import { Stack } from "expo-router";

export default function NPOLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="create-activity" options={{ presentation: 'card' }} />
            <Stack.Screen name="edit-activity/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            <Stack.Screen name="edit-profile" options={{ presentation: 'card', title: 'Modifica Profilo' }} />
            <Stack.Screen name="security" options={{ presentation: 'card', title: 'Sicurezza' }} />
        </Stack>
    );
}
