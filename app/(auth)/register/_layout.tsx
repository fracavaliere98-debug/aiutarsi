import { Stack } from "expo-router";

export default function RegisterLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="volunteer" />
            <Stack.Screen name="npo" />
            <Stack.Screen name="corporate" />
        </Stack>
    );
}
