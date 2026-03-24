import { Stack } from "expo-router";
import { STACK_TRANSITIONS } from "../../constants/motion";

export default function NPOLayout() {
    return (
        <Stack screenOptions={STACK_TRANSITIONS.root}>
            <Stack.Screen name="(tabs)" options={STACK_TRANSITIONS.root} />
            <Stack.Screen name="create-activity" options={STACK_TRANSITIONS.modal} />
            <Stack.Screen name="edit-activity/[id]" options={STACK_TRANSITIONS.modal} />
            <Stack.Screen name="notifications" options={STACK_TRANSITIONS.modal} />
            <Stack.Screen name="edit-profile" options={{ ...STACK_TRANSITIONS.modal, title: 'Modifica Profilo' }} />
            <Stack.Screen name="security" options={{ ...STACK_TRANSITIONS.modal, title: 'Sicurezza' }} />
        </Stack>
    );
}
