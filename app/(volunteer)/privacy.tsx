import React, { useState, useEffect } from "react";
import { View, Text, Switch, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Phone, Eye, BookOpen, Mail, Save } from "lucide-react-native";
import { StandardLayout } from "../../components/StandardLayout";
import { SoftCard } from "../../components/SoftCard";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../utils/supabase";
import { Colors } from "../../constants/Colors";

export default function VolunteerPrivacyScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // Privacy flags
    const [allowCalls, setAllowCalls] = useState(true);
    const [profilePublic, setProfilePublic] = useState(true);
    const [showEmail, setShowEmail] = useState(false);
    const [showVolunteeringHistory, setShowVolunteeringHistory] = useState(true);

    useEffect(() => {
        const fetchPrivacy = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('profiles')
                .select('allow_calls, profile_public, show_email, show_volunteering_history')
                .eq('id', user.id)
                .single();
            if (data) {
                setAllowCalls(data.allow_calls !== false);
                setProfilePublic(data.profile_public !== false);
                setShowEmail(!!data.show_email);
                setShowVolunteeringHistory(data.show_volunteering_history !== false);
            }
            setIsFetching(false);
        };
        fetchPrivacy();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    allow_calls: allowCalls,
                    profile_public: profilePublic,
                    show_email: showEmail,
                    show_volunteering_history: showVolunteeringHistory,
                })
                .eq('id', user.id);
            if (error) throw error;
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
            <ActivityIndicator color={Colors.primary} />
        </View>
    );

    return (
        <StandardLayout title="Privacy e Visibilità" label="Impostazioni" onBack={() => router.back()}>

            {/* Calls */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">CHIAMATE</Text>
            <SoftCard className="p-5 mb-6">
                <PrivacyRow
                    icon={<Phone size={22} color={allowCalls ? Colors.success : Colors.secondary} />}
                    iconBg={allowCalls ? "bg-emerald-50" : "bg-slate-100"}
                    title="Ricevi chiamate dall'app"
                    subtitle={allowCalls ? "Le NPO possono chiamarti direttamente" : "Il tasto chiamata è disabilitato per le NPO"}
                    value={allowCalls}
                    onValueChange={setAllowCalls}
                    trackTrue={Colors.success}
                />
            </SoftCard>

            {/* Profile */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">PROFILO</Text>
            <SoftCard className="p-5 mb-4">
                <PrivacyRow
                    icon={<Eye size={22} color={Colors.primary} />}
                    iconBg="bg-indigo-50"
                    title="Profilo pubblico"
                    subtitle="Il tuo profilo è visibile a tutte le NPO"
                    value={profilePublic}
                    onValueChange={setProfilePublic}
                />
            </SoftCard>
            <SoftCard className="p-5 mb-4">
                <PrivacyRow
                    icon={<Mail size={22} color={Colors.primary} />}
                    iconBg="bg-blue-50"
                    title="Mostra email di contatto"
                    subtitle="L'email è visibile sul tuo profilo"
                    value={showEmail}
                    onValueChange={setShowEmail}
                />
            </SoftCard>
            <SoftCard className="p-5 mb-8">
                <PrivacyRow
                    icon={<BookOpen size={22} color={Colors.primary} />}
                    iconBg="bg-amber-50"
                    title="Storico volontariato visibile"
                    subtitle="Le NPO possono vedere le tue attività passate (CV volontariato)"
                    value={showVolunteeringHistory}
                    onValueChange={setShowVolunteeringHistory}
                />
            </SoftCard>

            {/* Save */}
            <View className="absolute bottom-6 left-6 right-6">
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
                trackColor={{ false: "#e2e8f0", true: trackTrue || Colors.primary }}
            />
        </View>
    );
}
