import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../components/StandardLayout";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { Save, User, Briefcase, MessageSquare, Camera } from "lucide-react-native";
import { useToast } from "../../context/ToastContext";
import { UserAvatar } from "../../components/UserAvatar";
import * as ImagePicker from 'expo-image-picker';
import { requestMediaLibraryPermission } from "../../utils/permissions";

const InputField = ({ label, value, onChangeText, placeholder, icon: Icon, multiline = false }: any) => (
    <View className="mb-6">
        <Text className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-2 ml-1">
            {label}
        </Text>
        <View className={`flex-row items-center bg-white border border-gray-100 rounded-2xl px-4 ${multiline ? 'items-start py-4' : 'h-14'}`}>
            <Icon size={20} color="#94a3b8" style={multiline ? { marginTop: 2 } : {}} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#cbd5e1"
                className={`flex-1 ml-3 text-primary font-bold text-base ${multiline ? 'h-32' : ''}`}
                multiline={multiline}
                textAlignVertical={multiline ? "top" : "center"}
            />
        </View>
    </View>
);

export default function ReferentDetailsSettings({ onClose }: { onClose?: () => void }) {
    const router = useRouter();
    const { user, updateUserProfile } = useAuth();
    const { showToast } = useToast();

    const [name, setName] = useState(user?.referent_name || "");
    const [role, setRole] = useState(user?.referent_role || "");
    const [avatar, setAvatar] = useState(user?.referent_avatar_url || "");
    const [welcomeMessage, setWelcomeMessage] = useState(user?.auto_welcome_message || "");
    const [saving, setSaving] = useState(false);

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per aggiornare la foto del referente.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            showToast("error", "Permesso galleria necessario.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!name || !role) {
            showToast("error", "Nome e ruolo sono obbligatori.");
            return;
        }

        setSaving(true);
        try {
            await updateUserProfile({
                referent_name: name,
                referent_role: role,
                referent_avatar_url: avatar,
                auto_welcome_message: welcomeMessage
            } as any);
            showToast("success", "Dati referente aggiornati!");
            if (onClose) {
                onClose();
            } else {
                router.back();
            }
        } catch (error) {
            console.error("Failed to save referent details", error);
            showToast("error", "Errore durante il salvataggio.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <StandardLayout
            label="Impostazioni"
            title="Referente Principale"
            bg="bg-background-light"
            onBack={onClose || (() => router.back())}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    {/* Avatar Selection */}
                    <View className="items-center mb-8 mt-2">
                        <TouchableOpacity 
                            onPress={pickImage}
                            activeOpacity={0.8}
                            className="relative"
                        >
                            <UserAvatar 
                                size={120} 
                                name={name || "R"} 
                                avatarUrl={avatar}
                                fontSize={42}
                            />
                            <View className="absolute bottom-0 right-0 bg-accent p-2.5 rounded-full border-4 border-white">
                                <Camera size={20} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text className="text-secondary font-bold text-xs mt-4 uppercase tracking-tighter">
                            Foto del referente
                        </Text>
                    </View>

                    {/* Form Fields */}
                    <InputField
                        label="Nome e Cognome"
                        value={name}
                        onChangeText={setName}
                        placeholder="Es. Mario Rossi"
                        icon={User}
                    />

                    <InputField
                        label="Ruolo nell'organizzazione"
                        value={role}
                        onChangeText={setRole}
                        placeholder="Es. Responsabile Risorse Umane"
                        icon={Briefcase}
                    />

                    <InputField
                        label="Messaggio di Benvenuto Automatico"
                        value={welcomeMessage}
                        onChangeText={setWelcomeMessage}
                        placeholder="Scrivi un messaggio di accoglienza per i nuovi volontari..."
                        icon={MessageSquare}
                        multiline
                    />
                    
                    <Text className="text-gray-400 text-xs px-2 italic">
                        Questo messaggio verrà inviato automaticamente in chat ai volontari scelti per i tuoi progetti.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Save Button (Floating) */}
            <View className="absolute bottom-6 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    className={`py-4 rounded-2xl shadow-xl flex-row justify-center items-center gap-2 ${saving ? "bg-gray-300" : "bg-primary"
                        }`}
                >
                    {saving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <View className="flex-row items-center gap-2">
                            <Save size={20} color="white" />
                            <Text className="text-white text-lg font-black">Salva Modifiche</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}
