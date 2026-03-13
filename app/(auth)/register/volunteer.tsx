import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { ScreenWrapper } from "../../../components/ScreenWrapper";


import { useState } from "react";

export default function VolunteerRegister() {
    const router = useRouter();
    const { register } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
    });

    const handleRegister = async () => {
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
            showToast("error", "Compila tutti i campi obbligatori.");
            return;
        }

        setIsLoading(true);
        try {
            await register({
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                password: formData.password,
                role: "VOLUNTEER",
                profileCompleted: false
            });

            router.replace("/onboarding/intro");

        } catch (error: any) {
            showToast("error", error.message || "Errore durante la registrazione.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper className="px-6 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>

                <Text className="text-3xl font-black text-primary mb-2">Unisciti a noi</Text>
                <Text className="text-secondary mb-8">
                    Inizia il tuo viaggio nel volontariato certificato.
                </Text>

                <View className="gap-4">
                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Nome</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="Mario"
                            placeholderTextColor="#9ca3af"
                            value={formData.firstName}
                            onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Cognome</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="Rossi"
                            placeholderTextColor="#9ca3af"
                            value={formData.lastName}
                            onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Email</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="mario.rossi@email.com"
                            placeholderTextColor="#9ca3af"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Password</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="••••••••"
                            placeholderTextColor="#9ca3af"
                            secureTextEntry
                            value={formData.password}
                            onChangeText={(text) => setFormData({ ...formData, password: text })}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleRegister}
                    disabled={isLoading}
                    className={`bg-accent mt-8 py-4 rounded-xl shadow-lg active:scale-95 transition-transform items-center ${isLoading ? 'opacity-70' : ''}`}
                >
                    <Text className="text-white text-lg font-bold">{isLoading ? "Registrazione..." : "Crea Account"}</Text>
                </TouchableOpacity>

                <View className="flex-row justify-center mt-6 gap-2">
                    <Text className="text-secondary">Sei una NPO o un&apos;Azienda?</Text>
                    <TouchableOpacity onPress={() => router.push("/register/npo")}>
                        <Text className="text-primary font-bold underline">Registrati qui</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
