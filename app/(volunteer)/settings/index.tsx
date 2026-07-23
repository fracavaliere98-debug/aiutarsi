import React from "react";
import { Alert, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ChevronRight, Eye, FileText, Key, LifeBuoy, LogOut, ShieldBan, Users, User, Heart, ChartColumnIncreasing, Mail } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { AccountDeletionAlert } from "../../../components/AccountDeletionAlert";
import { UserAvatar } from "../../../components/UserAvatar";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { reportIssue } from "../../../utils/monitoring";
import { colors } from "@/theme";

const SectionHeader = ({ title }: { title: string }) => (
    <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-1">
        {title}
    </Text>
);

const MenuItem = ({
    icon: Icon,
    label,
    description,
    color,
    onPress,
    last = false,
    testID,
}: {
    icon: any;
    label: string;
    description?: string;
    color: string;
    onPress?: () => void;
    last?: boolean;
    testID?: string;
}) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`flex-row items-center justify-between py-4 ${!last ? "border-b border-gray-50" : ""}`}
        testID={testID}
    >
        <View className="flex-row items-center gap-4 flex-1 pr-3">
            <View style={{ backgroundColor: color + "15" }} className="p-2.5 rounded-2xl">
                <Icon size={20} color={color} />
            </View>
            <View className="flex-1">
                <Text className="text-primary font-bold text-base">{label}</Text>
                {!!description && (
                    <Text className="text-secondary text-xs mt-0.5">{description}</Text>
                )}
            </View>
        </View>
        <ChevronRight size={18} color="#cbd5e1" />
    </TouchableOpacity>
);

export default function VolunteerSettingsScreen() {
    const { user, logout, isLoading: isAuthLoading, requestAccountDeletion } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const appVersion = Constants.expoConfig?.version || "1.0.0";

    return (
        <StandardLayout
            label="Il tuo account"
            title="Impostazioni"
            bg="bg-white"
            onBack={() => router.back()}
        >
            <AccountDeletionAlert />

            <SoftCard className="mb-8 items-center p-6 mt-2">
                <UserAvatar
                    size={100}
                    fontSize={32}
                    name={user?.name || "Utente"}
                    avatarUrl={user?.avatar || user?.avatar_url || undefined}
                    useAuthFallback
                />

                <Text className="text-primary font-black text-2xl mt-4 text-center">
                    {user?.name || "Utente"}
                </Text>
                <Text className="text-secondary font-bold text-sm mt-1 text-center">
                    ID: #{user?.shortId || user?.id?.substring(0, 8).toUpperCase() || "N/A"}
                </Text>

                <TouchableOpacity
                    className="mt-6 px-8 py-3 rounded-2xl"
                    activeOpacity={0.7}
                    style={{ backgroundColor: colors.primary + '10' }}
                    onPress={() => router.push("/(volunteer)/settings/edit-profile" as any)}
                >
                    <Text className="font-black text-sm" style={{ color: colors.primary }}>
                        Modifica profilo
                    </Text>
                </TouchableOpacity>
            </SoftCard>

            <SectionHeader title="Account" />
            <SoftCard className="mb-8 px-5">
                <MenuItem
                    icon={User}
                    label="Dati personali"
                    description="Nome, foto, biografia e contatti"
                    color={colors.primary}
                    onPress={() => router.push("/(volunteer)/settings/edit-profile" as any)}
                />
                <MenuItem
                    icon={Heart}
                    label="Interessi e competenze"
                    description="Aree di interesse e skill che vuoi mettere a disposizione"
                    color="#ec4899"
                    onPress={() => router.push("/(volunteer)/interests-skills" as any)}
                />
                <MenuItem
                    icon={Users}
                    label="Porta un amico"
                    description="Invita altri volontari su AiutarSi"
                    color={colors.primary}
                    onPress={() => router.push("/(volunteer)/referral" as any)}
                />
                <MenuItem
                    icon={ChartColumnIncreasing}
                    label="Report"
                    description="Il tuo impatto e la tua attività sulla piattaforma"
                    color={colors.accent}
                    onPress={() => router.push("/(volunteer)/report" as any)}
                    testID="volunteer-settings-report"
                    last
                />
            </SoftCard>

            {user && (user.role as string) === 'ADMIN' && (
                <>
                    <SectionHeader title="Amministrazione" />
                    <SoftCard className="mb-8 px-5">
                        <MenuItem
                            icon={ShieldBan}
                            label="Area Admin"
                            color="#8B5CF6"
                            onPress={() => router.push("/admin" as any)}
                            last
                        />
                    </SoftCard>
                </>
            )}

            <SectionHeader title="Sicurezza" />
            <SoftCard className="mb-8 px-5">
                <MenuItem
                    icon={Eye}
                    label="Privacy e visibilità"
                    description="Controlla cosa è visibile agli altri utenti"
                    color={colors.success}
                    onPress={() => router.push("/(volunteer)/settings/privacy" as any)}
                />
                <MenuItem
                    icon={ShieldBan}
                    label="Account bloccati"
                    description="Gestisci i profili che non possono interagire con te"
                    color={colors.accent}
                    onPress={() => router.push("/blocked-users" as any)}
                />
                <MenuItem
                    icon={Key}
                    label="Credenziali accesso"
                    description="Email, password e sicurezza"
                    color={colors.primary}
                    onPress={() => router.push("/(volunteer)/settings/security" as any)}
                    last
                />
            </SoftCard>

            <SectionHeader title="Supporto" />
            <SoftCard className="mb-8 px-5">
                <MenuItem
                    icon={LifeBuoy}
                    label="Centro assistenza"
                    description="FAQ e supporto con Gemma"
                    color="#ef4444"
                    onPress={() => router.push('/help-center' as any)}
                />
                <MenuItem
                    icon={Mail}
                    label="Segnala un problema"
                    description="Invia una segnalazione con i dettagli tecnici dell'app"
                    color={colors.accent}
                    onPress={() => {
                        void reportIssue({
                            user,
                            screen: "volunteer_settings",
                        });
                    }}
                />
                <MenuItem
                    icon={FileText}
                    label="Termini e condizioni"
                    description="Informazioni legali e condizioni d'uso"
                    color={colors.primary}
                    onPress={() => router.push("/terms" as any)}
                    last
                />
            </SoftCard>

            <SoftCard className="mb-8 px-5">
                <TouchableOpacity
                    onPress={async () => await logout()}
                    disabled={isAuthLoading}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-between py-4"
                >
                    <View className="flex-row items-center gap-4">
                        <View className="bg-red-50 p-2.5 rounded-2xl">
                            {isAuthLoading ? (
                                <ActivityIndicator size={20} color="#ef4444" />
                            ) : (
                                <LogOut size={20} color="#ef4444" />
                            )}
                        </View>
                        <Text className="text-red-500 font-bold text-base">Esci dall&apos;account</Text>
                    </View>
                    <ChevronRight size={18} color="#fca5a5" />
                </TouchableOpacity>
            </SoftCard>

            <TouchableOpacity
                className="mb-8 items-center"
                onPress={() => {
                    Alert.alert(
                        "Elimina account",
                        "Sei sicuro di voler eliminare il tuo account? Avrai 30 giorni per cambiare idea e annullare la richiesta dal tuo profilo.",
                        [
                            { text: "Annulla", style: "cancel" },
                            {
                                text: "Elimina",
                                style: "destructive",
                                onPress: async () => {
                                    try {
                                        await requestAccountDeletion();
                                        showToast('success', 'Richiesta di eliminazione inviata correttamente.');
                                    } catch (error: any) {
                                        Alert.alert("Errore", error.message);
                                    }
                                }
                            }
                        ]
                    );
                }}
            >
                <Text className="text-red-400 font-bold">Elimina account</Text>
            </TouchableOpacity>

            <View className="mb-10 items-center">
                <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">
                    AiutarSi v{appVersion}
                </Text>
            </View>
        </StandardLayout>
    );
}
