import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { ScreenWrapper } from "../../../components/ScreenWrapper";
import { useState } from "react";

import { Colors } from "../../../constants/Colors";
import { ArrowLeft } from "lucide-react-native";

export default function NPORegister() {
    const router = useRouter();
    const { register } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        orgName: "",
        taxId: "",
        email: "",
        password: "",
    });

    const handleRegister = async () => {
        setIsLoading(true);
        try {
            await register({
                name: formData.orgName,
                email: formData.email,
                password: formData.password,
                role: "NPO",
                npoName: formData.orgName,
            });
            router.replace("/(npo)" as any);
        } catch (error: any) {
            alert(error.message || "Errore durante la registrazione.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper className="px-6 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text className="text-3xl font-black text-primary mb-2">Registra Ente</Text>
                <Text className="text-secondary mb-8">
                    Digitalizza la gestione dei tuoi volontari.
                </Text>

                <View className="gap-4">
                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Nome Organizzazione</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="Associazione Onlus..."
                            placeholderTextColor="#9ca3af"
                            value={formData.orgName}
                            onChangeText={(text) => setFormData({ ...formData, orgName: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Codice Fiscale / P.IVA</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="12345678901"
                            placeholderTextColor="#9ca3af"
                            value={formData.taxId}
                            onChangeText={(text) => setFormData({ ...formData, taxId: text })}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-bold text-primary mb-2 ml-1">Email Istituzionale</Text>
                        <TextInput
                            className="bg-white p-4 rounded-xl border border-primary/10 text-primary"
                            placeholder="info@associazione.org"
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
                    <Text className="text-white text-lg font-bold">{isLoading ? "Registrazione..." : "Crea Account NPO"}</Text>
                </TouchableOpacity>

                <View className="flex-row justify-center mt-6 gap-2">
                    <Text className="text-secondary">Sei un'Azienda?</Text>
                    <TouchableOpacity onPress={() => router.push("/register/corporate")}>
                        <Text className="text-primary font-bold underline">Clicca qui</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
