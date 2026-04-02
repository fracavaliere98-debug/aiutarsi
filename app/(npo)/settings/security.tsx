import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Lock, Mail, Shield, Eye, EyeOff, Save } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Colors } from "../../../constants/Colors";
import { authService } from "../../../services/AuthService";
import { getPasswordRequirementsShortText, getPasswordRequirementsText, isPasswordStrongEnough } from "../../../utils/passwordValidation";

export default function SecurityScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // State
    const [loginEmail, setLoginEmail] = useState(user?.email || "");
    const [isEditingEmail, setIsEditingEmail] = useState(false);

    // Password State
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // 2FA State (Placeholder)
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // 1. Email Update
            if (loginEmail !== user?.email) {
                await authService.updateEmail(loginEmail);
                showToast("success", "Email aggiornata! Controlla la posta per confermare.");
                // Note: If email confirmation is enabled, the user might be logged out or stay on old email until confirmed.
            }

            // 2. Password Update
            if (newPassword) {
                if (!currentPassword) {
                    showToast("error", "Inserisci la password attuale per confermare le modifiche.");
                    setIsLoading(false);
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showToast("error", "Le nuove password non coincidono.");
                    setIsLoading(false);
                    return;
                }

                if (!isPasswordStrongEnough(newPassword)) {
                    showToast("error", getPasswordRequirementsShortText());
                    setIsLoading(false);
                    return;
                }

                await authService.updatePassword(currentPassword, newPassword);
                showToast("success", "Password aggiornata con successo!");
            } else if (currentPassword && !newPassword) {
                showToast("error", "Inserisci la nuova password.");
                setIsLoading(false);
                return;
            }

            if (loginEmail === user?.email && !newPassword) {
                showToast("info", "Nessuna modifica rilevata.");
            } else {
                router.back();
            }

        } catch (error: any) {
            console.error("Update credentials error:", error);
            showToast("error", error.message || "Errore durante l'aggiornamento.");
        } finally {
            setIsLoading(false);
        }
    };

    const PasswordInput = ({ label, value, onChangeText, placeholder = "••••••••" }: any) => (
        <View className="mb-4">
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-2 ml-1">{label}</Text>
            <View className="bg-white border border-gray-200 rounded-2xl flex-row items-center px-4 py-3">
                <Lock size={20} color={Colors.secondary} className="mr-3" />
                <TextInput
                    className="flex-1 text-primary font-medium text-base"
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={!showPassword}
                    placeholder={placeholder}
                    placeholderTextColor="#CBD5E1"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                        <EyeOff size={20} color={Colors.secondary} />
                    ) : (
                        <Eye size={20} color={Colors.secondary} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <StandardLayout
            title="Credenziali Accesso"
            label="Sicurezza"
            onBack={() => router.back()}
        >

            {/* Info Box */}
            <View className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex-row gap-3 mb-6">
                <InfoIcon />
                <View className="flex-1">
                    <Text className="text-blue-800 font-bold text-sm mb-1">Gestione Sicurezza</Text>
                    <Text className="text-blue-600 text-xs leading-4">
                        Modifica la tua email, aggiorna la password o attiva l&apos;autenticazione a due fattori per proteggere l&apos;account dell&apos;ente.
                    </Text>
                </View>
            </View>

            {/* Email Accesso */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">EMAIL DI ACCESSO</Text>
            <SoftCard className="p-5 mb-6">
                <View className="flex-row items-center gap-4">
                    <View className={`p-3 rounded-full ${isEditingEmail ? "bg-accent/10" : "bg-indigo-50"}`}>
                        <Mail size={24} color={isEditingEmail ? Colors.accent : Colors.primary} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-secondary text-xs font-bold uppercase">Email attuale</Text>
                        <TextInput
                            value={loginEmail}
                            onChangeText={setLoginEmail}
                            className={`font-black text-lg p-0 ${isEditingEmail ? "text-accent border-b border-accent" : "text-primary"}`}
                            keyboardType="email-address"
                            editable={isEditingEmail}
                        />
                    </View>
                    <TouchableOpacity onPress={() => setIsEditingEmail(!isEditingEmail)}>
                        <Text className={`${isEditingEmail ? "text-accent" : "text-primary"} font-bold text-sm`}>
                            {isEditingEmail ? "Annulla" : "Modifica"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SoftCard>

            {/* Password */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">PASSWORD</Text>
            <SoftCard className="p-5 mb-6">
                <PasswordInput label="Password Attuale" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Richiesta per conferma" />
                <View className="h-px bg-slate-100 my-2" />
                <PasswordInput label="Nuova Password" value={newPassword} onChangeText={setNewPassword} />
                <PasswordInput label="Conferma Nuova Password" value={confirmPassword} onChangeText={setConfirmPassword} />

                <Text className="text-secondary/60 text-[10px] mt-2 leading-4">
                    {getPasswordRequirementsText()}
                </Text>
            </SoftCard>

            {/* 2FA */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">SICUREZZA</Text>
            <SoftCard className="p-5 mb-24 flex-row items-center justify-between">
                <View className="flex-row items-center gap-4 flex-1">
                    <View className="bg-emerald-50 p-2.5 rounded-full">
                        <Shield size={24} color={Colors.success} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-primary font-bold text-base">Autenticazione a due fattori</Text>
                        <Text className="text-secondary text-xs">Richiedi codice OTP all&apos;accesso</Text>
                    </View>
                </View>
                <Switch
                    value={twoFactorEnabled}
                    onValueChange={setTwoFactorEnabled}
                    trackColor={{ false: "#e2e8f0", true: Colors.success }}
                />
            </SoftCard>

            {/* Floating Save Button */}
            <View className="absolute bottom-6 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isLoading}
                    className="bg-accent py-4 rounded-[24px] flex-row justify-center items-center shadow-lg shadow-accent/40 active:scale-95"
                >
                    <Save size={20} color="white" className="mr-2" />
                    <Text className="text-white font-black text-lg">
                        {isLoading ? "Verifica e Salva..." : "Aggiorna Credenziali"}
                    </Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}

function InfoIcon() {
    return (
        <View className="bg-blue-100 p-1 rounded-full w-6 h-6 items-center justify-center">
            <Text className="text-blue-600 font-bold text-xs">i</Text>
        </View>
    );
}
