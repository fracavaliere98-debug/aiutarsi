import React, { useState } from "react";
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Lock, Mail, Save } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { getPasswordRequirementsShortText, getPasswordRequirementsText, isPasswordStrongEnough } from "../../../utils/passwordValidation";
import { colors } from "@/theme";

export default function VolunteerSecurityScreen() {
    const { user, updateEmail, updatePassword } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();

    const [newEmail, setNewEmail] = useState("");
    const [emailUpdateNotice, setEmailUpdateNotice] = useState<string | null>(null);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const wantsEmailChange = !!newEmail;
        const wantsPasswordChange = !!(currentPassword || newPassword || confirmNewPassword);

        if (!wantsEmailChange && !wantsPasswordChange) {
            showToast("info", "Nessuna modifica da salvare.");
            return;
        }

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword) {
                Alert.alert("Errore", "Per cambiare la password compila tutti i campi.");
                return;
            }
            if (newPassword !== confirmNewPassword) {
                Alert.alert("Errore", "Le nuove password non coincidono.");
                return;
            }
            if (!isPasswordStrongEnough(newPassword)) {
                Alert.alert("Errore", getPasswordRequirementsText());
                return;
            }
        }

        setIsSaving(true);
        try {
            if (wantsEmailChange) {
                if (!newEmail.includes("@")) {
                    Alert.alert("Errore", "Inserisci un indirizzo email valido.");
                    setIsSaving(false);
                    return;
                }
                await updateEmail(newEmail);
                const notice = "Ti abbiamo inviato un link di conferma al nuovo indirizzo email.";
                showToast("success", notice);
                setEmailUpdateNotice(notice);
                setNewEmail("");
            }

            if (wantsPasswordChange) {
                await updatePassword(currentPassword, newPassword);
                showToast("success", "Password aggiornata con successo!");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
            }

            if (!wantsEmailChange) {
                router.back();
            }
        } catch (error: any) {
            Alert.alert("Errore", error.message || "Errore durante l'aggiornamento.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <StandardLayout title="Credenziali Accesso" label="Sicurezza" onBack={() => router.back()}>
            {/* Email Accesso */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">EMAIL DI ACCESSO</Text>
            <SoftCard className="p-5 mb-6">
                <View className="flex-row items-center gap-4">
                    <View className="bg-indigo-50 p-3 rounded-full">
                        <Mail size={24} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-secondary text-xs font-bold uppercase">Email attuale</Text>
                        <Text className="text-primary font-black text-lg">{user?.email}</Text>
                    </View>
                </View>
                <View className="h-px bg-slate-100 my-4" />
                <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">Nuova email (opzionale)</Text>
                <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <TextInput
                        value={newEmail}
                        onChangeText={setNewEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        className="text-primary font-medium text-base p-0"
                        placeholder="Nuovo indirizzo email"
                        placeholderTextColor="#9ca3af"
                    />
                </View>
                <Text className="text-secondary/60 text-xs mt-3 px-1 leading-5">
                    Per motivi di sicurezza, riceverai un link di conferma al nuovo indirizzo. L&apos;email non verrà cambiata finché non confermerai il link.
                </Text>
                {emailUpdateNotice ? (
                    <View className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                        <Text className="text-green-800 text-sm font-semibold">{emailUpdateNotice}</Text>
                    </View>
                ) : null}
            </SoftCard>

            {/* Password */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">PASSWORD</Text>
            <SoftCard className="p-5 mb-24">
                <PasswordField label="Password Attuale" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Richiesta per confermare le modifiche" />
                <PasswordField label="Nuova Password" value={newPassword} onChangeText={setNewPassword} placeholder="8+ caratteri, 1 maiuscola, 1 numero" />
                <PasswordField label="Conferma Nuova Password" value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Ripeti la nuova password" />
                <Text className="text-secondary/60 text-[10px] mt-1 leading-4">
                    {getPasswordRequirementsShortText()}
                </Text>
            </SoftCard>

            {/* Floating Save Button */}
            <View className="absolute bottom-6 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    className="bg-accent py-4 rounded-[24px] flex-row justify-center items-center shadow-lg shadow-accent/40 active:scale-95"
                >
                    {isSaving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Save size={20} color="white" className="mr-2" />
                            <Text className="text-white font-black text-lg">Aggiorna Credenziali</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}

const PasswordField = ({
    label,
    value,
    onChangeText,
    placeholder,
}: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
}) => (
    <View className="mb-4">
        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">{label}</Text>
        <View className="bg-white border border-gray-200 rounded-2xl flex-row items-center px-4 py-3">
            <Lock size={20} color={colors.textSecondary} className="mr-3" />
            <TextInput
                className="flex-1 text-primary font-medium text-base"
                value={value}
                onChangeText={onChangeText}
                secureTextEntry
                placeholder={placeholder || "••••••••"}
                placeholderTextColor="#CBD5E1"
            />
        </View>
    </View>
);
