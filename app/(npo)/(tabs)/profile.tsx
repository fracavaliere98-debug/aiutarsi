import React from "react";
import { Alert, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import {
    Camera,
    ChevronRight,
    Eye,
    FileText,
    Key,
    LifeBuoy,
    LogOut,
    ShieldBan,
    Target,
    UserCircle,
    Users,
    Globe,
    MessageCircle,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { StatCard } from "../../../components/StatCard";
import { UserAvatar } from "../../../components/UserAvatar";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";
import { AccountDeletionAlert } from "../../../components/AccountDeletionAlert";
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

export default function NPOProfileScreen() {
    const { user, logout, isLoading: isAuthLoading, updateUserProfile, requestAccountDeletion } = useAuth();
    const { getNPOApplications } = useApplications();
    const { showToast } = useToast();
    const router = useRouter();
    const appVersion = Constants.expoConfig?.version || "1.0.0";

    const applications = getNPOApplications(user?.id || "");
    const teamCount = applications.filter((a) => a.status === "APPROVED").length;
    const pendingCount = applications.filter((a) => a.status === "PENDING").length;
    const activeCategories = user?.interests?.length || 0;
    const soughtSkills = user?.sought_skills?.length || 0;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            showToast("error", "Permesso galleria necessario.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            await updateUserProfile({ avatar_url: result.assets[0].uri });
            showToast("success", "Logo aggiornato.");
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: "white" }}>
            <StandardLayout
                label="Il tuo ente"
                title="Profilo"
                rightElement={<NPOHeaderActions />}
                hideBack={true}
            >
                <AccountDeletionAlert />

                <SoftCard className="mb-6 mt-2 p-6">
                    <View className="items-center">
                        <TouchableOpacity onPress={pickImage} activeOpacity={0.8} className="relative">
                            <UserAvatar
                                size={104}
                                fontSize={34}
                                useAuthFallback={true}
                                role="NPO"
                                isVerified={!!(user?.isVerified || user?.is_verified)}
                                verificationStatus={user?.verification_status}
                            />
                            <View
                                className="absolute bottom-0 right-0 p-2 rounded-full border-4 border-white"
                                style={{ backgroundColor: Colors.primary }}
                            >
                                <Camera size={16} color="white" />
                            </View>
                        </TouchableOpacity>

                        <Text className="text-primary font-black text-2xl mt-4 text-center">
                            {user?.npoName || user?.name || "Ente Solidale"}
                        </Text>
                        <Text className="text-secondary font-bold text-sm mt-1 text-center">
                            {user?.locationString || user?.address_full || "Sede da completare"}
                        </Text>
                        {!!user?.bio && (
                            <Text className="text-secondary text-sm leading-6 text-center mt-4">
                                {user.bio}
                            </Text>
                        )}
                    </View>
                </SoftCard>

                <View className="flex-row gap-3 mb-8">
                    <View className="flex-1 h-24">
                        <StatCard
                            value={teamCount.toString()}
                            label="TEAM ATTIVO"
                            valueColor="text-pink-600"
                            icon={<Users size={14} color="#db2777" />}
                        />
                    </View>
                    <View className="flex-1 h-24">
                        <StatCard
                            value={pendingCount.toString()}
                            label="IN ATTESA"
                            valueColor="text-amber-600"
                            icon={<MessageCircle size={14} color="#d97706" />}
                        />
                    </View>
                    <View className="flex-1 h-24">
                        <StatCard
                            value={`${activeCategories}/${soughtSkills}`}
                            label="SETTORI/SKILL"
                            valueColor="text-indigo-600"
                            icon={<Target size={14} color="#4f46e5" />}
                        />
                    </View>
                </View>

                <SectionHeader title="Profilo ente" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={Globe}
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
                        onPress={() => router.push("/(npo)/security" as any)}
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
        </View>
    );
}
