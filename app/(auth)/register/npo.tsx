import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { ScreenWrapper } from "../../../components/ScreenWrapper";
import { useState } from "react";




export default function NPORegister() {
    const router = useRouter();
    const { register } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        orgName: "",
        taxId: "",
        email: "",
        password: "",
    });
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

    const handleRegister = async () => {
        if (!acceptedPrivacy) {
            showToast("error", "Devi accettare la privacy e i termini.");
            return;
        }
        setIsLoading(true);
        try {
            await register({
                full_name: formData.orgName,
                email: formData.email,
                password: formData.password,
                role: "NPO",
                profile_completed: false,
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
                    onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
                    className="flex-row items-center mt-6 px-1"
                >
                    <View className={`w-6 h-6 rounded-md border-2 mr-3 items-center justify-center ${acceptedPrivacy ? 'bg-primary border-primary' : 'border-primary/20'}`}>
                        {acceptedPrivacy && <Text className="text-white text-xs">✓</Text>}
                    </View>
                    <Text className="text-sm text-secondary flex-1">
                        Accetto la <Text onPress={() => router.push("/(corporate)/privacy-policy")} className="text-primary font-bold underline">Privacy Policy</Text> e i <Text onPress={() => router.push("/(corporate)/terms")} className="text-primary font-bold underline">Termini di Servizio</Text>
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleRegister}
                    disabled={isLoading || !acceptedPrivacy}
                    className={`bg-primary mt-8 py-4 rounded-xl shadow-lg active:scale-95 transition-transform items-center ${isLoading || !acceptedPrivacy ? 'opacity-50' : ''}`}
                >
                    <Text className="text-white text-lg font-bold">{isLoading ? "Registrazione..." : "Crea Account NPO"}</Text>
                </TouchableOpacity>

                <View className="flex-row justify-center mt-6 gap-2">
                    <Text className="text-secondary">Sei un&apos;Azienda?</Text>
                    <TouchableOpacity onPress={() => router.push("/register/corporate")}>
                        <Text className="text-primary font-bold underline">Clicca qui</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}
