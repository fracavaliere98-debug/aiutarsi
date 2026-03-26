import React from "react";
import { Alert, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ChevronRight, Eye, FileText, Key, LifeBuoy, LogOut, ShieldBan, Target, UserCircle, Users, Building2 } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { AccountDeletionAlert } from "../../../components/AccountDeletionAlert";
import { UserAvatar } from "../../../components/UserAvatar";
import { useApplications } from "../../../context/ApplicationContext";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Colors } from "../../../constants/Colors";

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
    badge,
    last = false,
}: {
    icon: any;
    label: string;
    description?: string;
    color: string;
    onPress?: () => void;
    badge?: string | number;
    last?: boolean;
}) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`flex-row items-center justify-between py-4 ${!last ? "border-b border-gray-50" : ""}`}
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
        <View className="flex-row items-center gap-2">
            {badge !== undefined && (
                <View className="bg-gray-100 px-2.5 py-1 rounded-lg">
                    <Text className="text-secondary font-bold text-xs">{badge}</Text>
                </View>
            )}
            <ChevronRight size={18} color="#cbd5e1" />
        </View>
    </TouchableOpacity>
);

export default function NPOSettingsScreen() {
    const { user, logout, isLoading: isAuthLoading, requestAccountDeletion } = useAuth();
    const { getNPOApplications } = useApplications();
    const { showToast } = useToast();
    const router = useRouter();
    const appVersion = Constants.expoConfig?.version || "1.0.0";

    const applications = getNPOApplications(user?.id || "");
    const teamCount = applications.filter((a) => a.status === "APPROVED").length;

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
                    name={user?.npoName || user?.name || "Ente"}
                    avatarUrl={user?.avatar || user?.avatar_url || undefined}
                    role="NPO"
                    isVerified={!!(user?.isVerified || user?.is_verified)}
                    verificationStatus={user?.verification_status}
                />

                <Text className="text-primary font-black text-2xl mt-4 text-center">
                    {user?.npoName || user?.name || "Il tuo ente"}
                </Text>
                <Text className="text-secondary font-bold text-sm mt-1 text-center">
                    ID: #{user?.shortId || user?.id?.substring(0, 8).toUpperCase() || "N/A"}
                </Text>

                <TouchableOpacity
                    className="mt-6 px-8 py-3 rounded-2xl"
                    activeOpacity={0.7}
                    style={{ backgroundColor: Colors.primary + '10' }}
                    onPress={() => router.push("/(npo)/edit-profile" as any)}
                >
                    <Text className="font-black text-sm" style={{ color: Colors.primary }}>
                        Modifica profilo ente
                    </Text>
                </TouchableOpacity>
            </SoftCard>

            <SectionHeader title="Profilo ente" />
            <SoftCard className="mb-8 px-5">
                <MenuItem
                    icon={Building2}
                    label="Modifica profilo"
                    description="Logo, missione, contatti e sede operativa"
                    color={Colors.primary}
                    onPress={() => router.push("/(npo)/edit-profile" as any)}
                />
                <MenuItem
                    icon={Target}
                    label="Settori e competenze"
                    description="Aree di intervento e skill che cercate nei volontari"
                    color={Colors.primary}
                    onPress={() => router.push("/(npo)/interests-skills" as any)}
                />
                <MenuItem
                    icon={UserCircle}
                    label="Referente principale"
                    description="Persona di riferimento visibile sul profilo pubblico"
                    color={Colors.primary}
                    onPress={() => router.push("/(npo)/referent-details" as any)}
                    last
                />
            </SoftCard>

            <SectionHeader title="Gestione e sicurezza" />
            <SoftCard className="mb-8 px-5">
                <MenuItem
                    icon={Users}
                    label="Membri del team"
                    description="Gestisci iscritti e candidature ricevute"
                    color={Colors.primary}
                    badge={teamCount}
                    onPress={() => router.push("/(npo)/volunteers?tab=ISCRITTI" as any)}
                />
                <MenuItem
                    icon={Eye}
                    label="Privacy e visibilità"
                    description="Controlla cosa è visibile agli utenti"
                    color={Colors.success}
                    onPress={() => router.push("/(npo)/settings/privacy" as any)}
                />
                <MenuItem
                    icon={ShieldBan}
                    label="Account bloccati"
                    description="Gestisci i profili che non possono interagire"
                    color={Colors.accent}
                    onPress={() => router.push("/blocked-users" as any)}
                />
                <MenuItem
                    icon={Key}
                    label="Credenziali accesso"
                    description="Email, password e sicurezza"
                    color={Colors.primary}
                    onPress={() => router.push("/(npo)/settings/security" as any)}
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
                    onPress={() => router.push("/help-center" as any)}
                />
                <MenuItem
                    icon={FileText}
                    label="Termini e condizioni"
                    description="Informazioni legali e condizioni d'uso"
                    color={Colors.primary}
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
                        "Sei sicuro di voler eliminare il tuo account? Avrai 30 giorni per annullare la richiesta dal profilo.",
                        [
                            { text: "Annulla", style: "cancel" },
                            {
                                text: "Elimina",
                                style: "destructive",
                                onPress: async () => {
                                    try {
                                        await requestAccountDeletion();
                                        showToast("success", "Richiesta di eliminazione inviata correttamente.");
                                    } catch (error: any) {
                                        Alert.alert("Errore", error.message);
                                    }
                                },
                            },
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
