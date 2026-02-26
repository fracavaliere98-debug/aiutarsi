import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { ArrowLeft, Mail, Lock, LogIn } from "lucide-react-native";
import { Button } from "../../components/Button";

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Attenzione", "Per favore inserisci email e password");
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
            // Navigate to root - the _layout will redirect to the correct dashboard
            router.replace("/");
        } catch (error: any) {
            Alert.alert("Errore di Accesso", error.message || "Login fallito. Riprova.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper className="px-6 bg-background-light justify-center">
            <TouchableOpacity
                onPress={() => router.back()}
                className="absolute top-12 left-6 z-10 p-2 bg-white rounded-full shadow-sm"
            >
                <ArrowLeft size={24} color={Colors.primary} />
            </TouchableOpacity>

            <View className="items-center mb-10">
                <Image
                    source={require("../../assets/images/logo.png")}
                    className="w-40 h-24 mb-4"
                    resizeMode="contain"
                />
                <Text className="text-3xl font-black text-primary">Bentornato!</Text>
                <Text className="text-secondary text-center mt-2">
                    Accedi al tuo account per continuare a fare la differenza.
                </Text>
            </View>

            <View className="gap-4 mb-6">
                <View className="bg-white p-4 rounded-3xl border border-primary/10 flex-row items-center gap-3">
                    <Mail size={20} color={Colors.secondary} />
                    <TextInput
                        placeholder="Email"
                        className="flex-1 text-primary font-medium"
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                    />
                </View>
                <View className="bg-white p-4 rounded-3xl border border-primary/10 flex-row items-center gap-3">
                    <Lock size={20} color={Colors.secondary} />
                    <TextInput
                        placeholder="Password"
                        className="flex-1 text-primary font-medium"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                    />
                </View>
                <TouchableOpacity className="self-end">
                    <Text className="text-accent font-bold text-sm">Password dimenticata?</Text>
                </TouchableOpacity>
            </View>

            <Button
                title="Accedi"
                onPress={handleLogin}
                isLoading={isLoading}
                className="mb-6 rounded-3xl" // Extra rounded
            />

            <View className="flex-row justify-center gap-1">
                <Text className="text-secondary">Non hai un account?</Text>
                <TouchableOpacity onPress={() => router.push("/register/volunteer")}>
                    <Text className="text-primary font-bold">Registrati</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
}
