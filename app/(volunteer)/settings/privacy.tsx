import React, { useState, useEffect } from "react";
import { View, Text, Switch, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Phone, Save, Eye, Mail } from "lucide-react-native";
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
    // A26 P5: "Profilo pubblico" = colonna volunteer_list_visible (acceso di default).
    const [publicProfile, setPublicProfile] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsFetching(false);
            return;
        }

        const fetchPrivacy = async () => {
            setAllowCalls(user.allow_calls !== false);
            setPublicProfile(user.volunteer_list_visible !== false);
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
                volunteer_list_visible: publicProfile,
            });
            showToast("success", "Impostazioni privacy salvate!");
            router.back();
        } catch (e: any) {
            showToast("error", e.message || "Errore durante il salvataggio.");
        } finally {
            setIsLoading(false);
        }
    };

    // Spegnere il profilo pubblico limita molte funzioni: conferma esplicita con due scelte.
    const handlePublicProfileChange = (next: boolean) => {
        if (next) {
            setPublicProfile(true);
            return;
        }
        Alert.alert(
            "Vuoi togliere il profilo pubblico?",
            "Gli altri ti vedranno solo come, ad esempio, Marta B. e con il tuo livello. Potresti non poter usare gran parte delle funzioni dell'app, come ricevere consigli dagli enti. Se ti candidi, ti iscrivi a un'attività o rispondi a un ente, quell'ente vedrà comunque il tuo profilo.",
            [
                { text: "Resta pubblico", style: "cancel", onPress: () => setPublicProfile(true) },
                { text: "Non pubblico", onPress: () => setPublicProfile(false) },
            ]
        );
    };

    if (isFetching) return (
        <View className="flex-1 items-center justify-center bg-background-light">
            <ActivityIndicator color={colors.primary} />
        </View>
    );

    return (
        <StandardLayout title="Privacy e Visibilità" label="Impostazioni" onBack={() => router.back()}>

            {/* Public profile */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">PROFILO</Text>
            <SoftCard className="p-5 mb-6">
                <PrivacyRow
                    icon={<Eye size={22} color={publicProfile ? colors.success : colors.textSecondary} />}
                    iconBg={publicProfile ? "bg-emerald-50" : "bg-slate-100"}
                    title="Profilo pubblico"
                    subtitle={publicProfile
                        ? "Enti verificati e altri volontari vedono il tuo nome e cognome, il livello, i badge, le competenze e gli interessi. Email e telefono restano privati: li vede solo l'ente a cui li dai tu quando ti iscrivi o ti candidi."
                        : "Gli altri ti vedono solo come, ad esempio, Marta B. e con il tuo livello."}
                    value={publicProfile}
                    onValueChange={handlePublicProfileChange}
                    trackTrue={colors.success}
                />
            </SoftCard>

            {/* Contatti: nessun interruttore, la scelta si fa a ogni iscrizione o candidatura */}
            <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">CONTATTI</Text>
            <SoftCard className="p-5 mb-6">
                <View className="flex-row items-start">
                    <View className="w-11 h-11 rounded-2xl items-center justify-center mr-4 bg-slate-100">
                        <Mail size={22} color={colors.textSecondary} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-primary font-bold text-base">Email e telefono</Text>
                        <Text className="text-secondary text-sm mt-1">
                            Gli enti non vedono mai la tua email del profilo. Quando ti iscrivi a un&apos;attività o ti candidi scegli tu cosa condividere con quell&apos;ente: l&apos;email è già compilata, ma puoi cambiarla o toglierla.
                        </Text>
                    </View>
                </View>
            </SoftCard>

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
