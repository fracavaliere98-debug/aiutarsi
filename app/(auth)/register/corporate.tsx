import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { ScreenWrapper } from "../../../components/ScreenWrapper";
import { useState } from "react";




export default function CorporateRegister() {
    const router = useRouter();
    const { register } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: "",
        vatId: "",
        email: "",
        password: "",
    });

    const handleRegister = async () => {
        setIsLoading(true);
        try {
            await register({
                name: formData.companyName,
                email: formData.email,
                password: formData.password,
                role: "CORPORATE",
                companyName: formData.companyName,
            });
            router.replace("/(corporate)" as any);
        } catch (error: any) {
            alert(error.message || "Errore durante la registrazione.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper className="px-6 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text className="text-3xl font-black text-primary mb-2">Registra Azienda</Text>
                <Text className="text-secondary mb-8">
                    Migliora il tuo ESG score con il volontariato aziendale.
                </Text>

                <View className="gap-4">
                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Ragione Sociale</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="Azienda SpA"
                            placeholderTextColor="#9ca3af"
                            value={formData.companyName}
                            onChangeText={(text) => setFormData({ ...formData, companyName: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Partita IVA</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="IT12345678901"
                            placeholderTextColor="#9ca3af"
                            value={formData.vatId}
                            onChangeText={(text) => setFormData({ ...formData, vatId: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Email Aziendale</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="hr@azienda.com"
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
                    className={`bg-primary mt-8 py-4 rounded-xl shadow-lg active:scale-95 transition-transform items-center ${isLoading ? 'opacity-70' : ''}`}
                >
                    <Text className="text-white text-lg font-bold">{isLoading ? "Registrazione..." : "Crea Account Corporate"}</Text>
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
}
