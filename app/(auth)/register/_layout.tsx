import { Stack, useRouter } from "expo-router";
import { Colors } from "../../../constants/Colors";
import { TouchableOpacity } from "react-native";
import { ArrowLeft } from "lucide-react-native";

export default function RegisterLayout() {
    const router = useRouter();
    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: Colors.background,
                },
                headerTintColor: Colors.primary,
                headerTitleStyle: {
                    fontWeight: "bold",
                },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: Colors.background },
            }}
        >
            <Stack.Screen
                name="volunteer"
                options={{
                    title: "Diventa Volontario",
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
                            <ArrowLeft size={24} color={Colors.primary} />
                        </TouchableOpacity>
                    ),
                }}
            />
            <Stack.Screen name="npo" options={{ title: "Registra NPO" }} />
            <Stack.Screen name="corporate" options={{ title: "Registra Azienda" }} />
        </Stack>
    );
}
