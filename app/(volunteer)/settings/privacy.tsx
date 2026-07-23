import React, { useState, useEffect } from "react";
import { View, Text, Switch, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Phone, Save } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { colors } from "@/theme";

export default function VolunteerPrivacyScreen() {
    const { user, updateUserProfile } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // Privacy flags
    const [allowCalls, setAllowCalls] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsFetching(false);
            return;
        }

        const fetchPrivacy = async () => {
            setAllowCalls(user.allow_calls !== false);
            setIsFetching(false);
        };

        void fetchPrivacy();
    }, [user, user?.id]);

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            await updateUserProfile({
                allow_calls: allowCalls,
            });
            showToast("success", "Impostazioni privacy salvate!");
            router.back();
        } catch (e: any) {
            showToast("error", e.message || "Errore durante il salvataggio.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) return (
        <View className="flex-1 items-center justify-center bg-background-light">
            <ActivityIndicator color={colors.primary} />
        </View>
    );

    return (
        <StandardLayout title="Privacy e Visibilità" label="Impostazioni" onBack={() => router.back()}>

            {/* Calls */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">CHIAMATE</Text>
            <SoftCard className="p-5 mb-6">
                <PrivacyRow
                    icon={<Phone size={22} color={allowCalls ? colors.success : colors.textSecondary} />}
                    iconBg={allowCalls ? "bg-emerald-50" : "bg-slate-100"}
                    title="Ricevi chiamate dall'app"
                    subtitle={allowCalls ? "Le NPO possono chiamarti direttamente" : "Il tasto chiamata è disabilitato per le NPO"}
                    value={allowCalls}
                    onValueChange={setAllowCalls}
                    trackTrue={colors.success}
                />
            </SoftCard>

            <View style={{ height: 28 }} />

            {/* Save */}
            <View className="absolute bottom-4 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isLoading}
                    className="bg-accent py-4 rounded-[24px] flex-row justify-center items-center shadow-lg shadow-accent/40 active:scale-95"
                >
                    <Save size={20} color="white" />
                    <Text className="text-white font-black text-lg ml-2">
                        {isLoading ? "Salvataggio..." : "Salva Impostazioni"}
                    </Text>
                </TouchableOpacity>
            </View>
        </StandardLayout>
    );
}

function PrivacyRow({ icon, iconBg, title, subtitle, value, onValueChange, trackTrue }: any) {
    return (
        <View className="flex-row items-center gap-4">
            <View className={`${iconBg} p-2.5 rounded-full`}>{icon}</View>
            <View className="flex-1">
                <Text className="text-primary font-bold text-base">{title}</Text>
                <Text className="text-secondary text-xs mt-0.5">{subtitle}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: "#e2e8f0", true: trackTrue || colors.primary }}
            />
        </View>
    );
}
