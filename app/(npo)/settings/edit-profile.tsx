import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, MapPin, Globe, Mail, Phone, Info, Save, User as UserIcon } from 'lucide-react-native';
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { UserAvatar } from "../../../components/UserAvatar";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { requestMediaLibraryPermission } from "../../../utils/permissions";
import { colors } from "@/theme";

export default function EditProfileScreen({ onClose }: { onClose?: () => void }) {
    const { user, updateUserProfile } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState(user?.npoName || user?.name || "");
    const [publicEmail, setPublicEmail] = useState(user?.public_email || user?.publicEmail || "");
    const [website, setWebsite] = useState(user?.website || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [location, setLocation] = useState(user?.address_full || user?.locationString || "");
    const [vatId, setVatId] = useState(user?.npo_vat_id || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: "Accesso alla galleria",
            message: "AiutarSi ti chiede l'accesso alla galleria per aggiornare il logo del tuo ente.",
            settingsLabel: "la galleria",
        });
        if (!granted) {
            showToast('error', 'Permesso galleria necessario.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            // Vedi nota in app/(volunteer)/settings/edit-profile.tsx: 0.5 basta per un
            // logo/avatar mostrato piccolo, evitando codifiche base64 lente su file da più MB.
            quality: 0.5,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateUserProfile({
                npo_vat_id: vatId,
                npoName: name,
                name: name,
                publicEmail,
                website,
                phone,
                bio,
                locationString: location, // Legacy
                address_full: location, // Standard
                avatar
            });
            showToast("success", "Profilo aggiornato con successo!");
            if (onClose) onClose();
            else router.back();
        } catch {
            showToast("error", "Errore durante il salvataggio.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <StandardLayout title="Modifica Profilo" label="Impostazioni" onBack={onClose || (() => router.back())}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                {/* Avatar Section */}
                <View className="items-center mb-8 mt-2">
                    <TouchableOpacity onPress={pickImage} className="relative active:opacity-80">
                        <UserAvatar
                            size={100}
                            fontSize={32}
                            name={name}
                            avatarUrl={avatar}
                        />
                        <View className="absolute bottom-0 right-0 bg-primary p-2.5 rounded-full border-4 border-gray-50">
                            <Camera size={16} color="white" />
                        </View>
                    </TouchableOpacity>
                    <Text className="text-secondary text-xs mt-3 font-medium">Tocca per cambiare logo</Text>
                </View>

                {/* Form Fields */}
                <SoftCard className="p-6 mb-24">
                    <InputField
                        label="Nome Ente"
                        value={name}
                        onChangeText={setName}
                        placeholder="Es. Croce Rossa Italiana"
                        icon={UserIcon}
                    />

                    <InputField
                        label="Email Pubblica"
                        value={publicEmail}
                        onChangeText={setPublicEmail}
                        placeholder="contatti@ente.org"
                        icon={Mail}
                        keyboardType="email-address"
                    />

                    <InputField
                        label="Sito Web"
                        value={website}
                        onChangeText={setWebsite}
                        placeholder="https://www.ente.org"
                        icon={Globe}
                        keyboardType="url"
                    />

                    <InputField
                        label="Telefono"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+39 02 1234567"
                        icon={Phone}
                        keyboardType="phone-pad"
                    />

                    <InputField
                        label="P.IVA / Codice Fiscale"
                        value={vatId}
                        onChangeText={setVatId}
                        placeholder="Es. 12345678901"
                        icon={Globe}
                    />

                    <InputField
                        label="Descrizione / Mission"
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Descrivi la missione del tuo ente..."
                        icon={Info}
                        multiline
                    />

                    <InputField
                        label="Indirizzo Sede"
                        value={location}
                        onChangeText={setLocation}
                        placeholder="Via Roma 1, Milano"
                        icon={MapPin}
                    />
                </SoftCard>
            </KeyboardAvoidingView>

            {/* Floating Save Button */}
            <View className="absolute bottom-6 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isLoading}
                    className="bg-accent py-4 rounded-[24px] flex-row justify-center items-center shadow-lg shadow-accent/40 active:scale-95"
                >
                    <Save size={20} color="white" className="mr-2" />
                    <Text className="text-white font-black text-lg">
                        {isLoading ? "Salvataggio..." : "Salva Modifiche"}
                    </Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}

const InputField = ({
    label,
    value,
    onChangeText,
    placeholder,
    icon: Icon,
    multiline = false,
    keyboardType = "default" as any
}: {
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: any,
    multiline?: boolean,
    keyboardType?: any
}) => (
    <View className="mb-4">
        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">{label}</Text>
        <View className={`bg-white border border-gray-200 rounded-2xl flex-row items-${multiline ? 'start' : 'center'} px-4 py-3 focus:border-primary`}>
            <View className={`mr-3 ${multiline ? 'mt-1' : ''}`}>
                <Icon size={20} color={colors.textSecondary} />
            </View>
            <TextInput
                className={`flex-1 text-primary font-medium text-base ${multiline ? 'h-24 pb-2' : ''}`}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                multiline={multiline}
                textAlignVertical={multiline ? "top" : "center"}
                keyboardType={keyboardType}
            />
        </View>
    </View>
);
