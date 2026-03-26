import { Stack } from "expo-router";
import { STACK_TRANSITIONS } from "../../constants/motion";

export default function VolunteerStackLayout() {
    return (
        <Stack screenOptions={STACK_TRANSITIONS.root}>
            <Stack.Screen name="(tabs)" options={STACK_TRANSITIONS.root} />
            <Stack.Screen name="notifications" options={STACK_TRANSITIONS.modal} />
            <Stack.Screen name="interests-skills" options={STACK_TRANSITIONS.modal} />
            <Stack.Screen name="privacy" options={STACK_TRANSITIONS.modal} />
            <Stack.Screen name="referral" options={STACK_TRANSITIONS.push} />
            <Stack.Screen name="smart-match" options={STACK_TRANSITIONS.push} />
        </Stack>
    );
}
