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
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

    const handleRegister = async () => {
        if (!acceptedPrivacy) return;
        setIsLoading(true);
        try {
            await register({
                full_name: formData.companyName,
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
                    onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
                    className="flex-row items-center mt-6 px-1"
                >
                    <View className={`w-6 h-6 rounded-md border-2 mr-3 items-center justify-center ${acceptedPrivacy ? 'bg-primary border-primary' : 'border-primary/20'}`}>
                        {acceptedPrivacy && <Text className="text-white text-xs">✓</Text>}
                    </View>
                    <Text className="text-sm text-secondary flex-1">
                        Accetto la <Text className="text-primary font-bold">Privacy Policy</Text> e i <Text className="text-primary font-bold">Termini di Servizio</Text>
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleRegister}
                    disabled={isLoading || !acceptedPrivacy}
                    className={`bg-primary mt-8 py-4 rounded-xl shadow-lg active:scale-95 transition-transform items-center ${isLoading || !acceptedPrivacy ? 'opacity-50' : ''}`}
                >
                    <Text className="text-white text-lg font-bold">{isLoading ? "Registrazione..." : "Crea Account Corporate"}</Text>
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
}
