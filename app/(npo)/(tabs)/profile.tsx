import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal } from "react-native";
import Constants from 'expo-constants';
import * as ImagePicker from "expo-image-picker";
import {
    LogOut,
    Mail,
    Bell,
    Shield,
    ChevronRight,
    CreditCard,
    Users,
    Key,
    Eye,
    LifeBuoy,
    FileText,
    Pencil,
    Camera,
    X
} from "lucide-react-native";
import { SoftCard } from "../../../components/SoftCard";
import { StandardLayout } from "../../../components/StandardLayout";
import { Colors } from "../../../constants/Colors";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";
import { useNotifications } from "../../../context/NotificationContext";
import { useRouter } from "expo-router";
import { useApplications } from "../../../context/ApplicationContext";
import { useAuth } from "../../../context/AuthContext";
import { UserAvatar } from "../../../components/UserAvatar";
import EditProfileScreen from "../edit-profile";
import SecurityScreen from "../security";

export default function NPOProfileScreen() {
    const { user, logout, isLoading: isAuthLoading, updateUserProfile } = useAuth();
    const { getNPOApplications } = useApplications();
    const router = useRouter();
    const { unreadCount } = useNotifications();

    // Modal States
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);

    const appVersion = Constants.expoConfig?.version || "1.0.0";

    const pickImage = async () => {
        // Request permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Scusa, abbiamo bisogno dei permessi della galleria per farlo funzionare!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            await updateUserProfile({ avatar: result.assets[0].uri });
        }
    };

    // Calculate team members (Approved volunteers)
    const applications = getNPOApplications(user?.id || "");
    const teamCount = applications.filter(a => a.status === "APPROVED").length;

    const SectionHeader = ({ title }: { title: string }) => (
        <Text className="text-secondary font-bold text-xs uppercase tracking-widest mb-3 px-2">
            {title}
        </Text>
    );

    const MenuItem = ({
        icon: Icon,
        label,
        color,
        onPress,
        badge,
        last = false
    }: {
        icon: any,
        label: string,
        color: string,
        onPress?: () => void,
        badge?: string | number,
        last?: boolean
    }) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`flex-row items-center justify-between py-4 ${!last ? 'border-b border-gray-50' : ''}`}
        >
            <View className="flex-row items-center gap-4">
                <View style={{ backgroundColor: color + '15' }} className="p-2.5 rounded-2xl">
                    <Icon size={20} color={color} />
                </View>
                <Text className="text-primary font-bold text-base">{label}</Text>
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

    const HeaderActions = <NPOHeaderActions />;

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <StandardLayout
                label="SISTEMA"
                title="Impostazioni"
                rightElement={HeaderActions}
            >
                {/* Profile Info Card */}
                <SoftCard className="mb-8 items-center p-6 mt-2">
                    <TouchableOpacity
                        onPress={pickImage}
                        activeOpacity={0.8}
                        className="relative"
                    >
                        <UserAvatar size={100} fontSize={32} useAuthFallback={true} />
                        <View
                            className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-4 border-white"
                            style={{ backgroundColor: Colors.primary }}
                        >
                            <Camera size={16} color="white" />
                        </View>
                    </TouchableOpacity>

                    <Text className="text-primary font-black text-2xl mt-4 text-center">
                        {user?.npoName || user?.name || "Ente Solidale"}
                    </Text>
                    <Text className="text-secondary font-bold text-sm mt-1">
                        ID Ente: #{user?.shortId || user?.id?.substring(0, 8).toUpperCase() || "N/A"}
                    </Text>

                    <TouchableOpacity
                        className="mt-6 px-8 py-3 rounded-2xl"
                        activeOpacity={0.7}
                        style={{ backgroundColor: Colors.primary + '10' }}
                        onPress={() => setShowEditProfile(true)}
                    >
                        <Text className="font-black text-sm" style={{ color: Colors.primary }}>
                            Modifica Profilo
                        </Text>
                    </TouchableOpacity>
                </SoftCard>

                {/* ACCOUNT Section */}
                <SectionHeader title="Account" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={CreditCard}
                        label="Dati Fatturazione"
                        color={Colors.primary}
                    />
                    <MenuItem
                        icon={Users}
                        badge={teamCount}
                        label="Membri del Team"
                        color={Colors.primary}
                        onPress={() => router.push("/(npo)/volunteers?tab=ISCRITTI" as any)}
                    />
                    <MenuItem
                        icon={Bell}
                        badge={unreadCount > 0 ? unreadCount : undefined}
                        label="Notifiche"
                        color={Colors.accent}
                        onPress={() => router.push("/(npo)/notifications" as any)}
                    />
                    <MenuItem
                        icon={Key}
                        label="Credenziali Accesso"
                        color={Colors.primary}
                        onPress={() => setShowSecurity(true)}
                        last
                    />
                </SoftCard>

                {/* SUPPORTO Section */}
                <SectionHeader title="Supporto" />
                <SoftCard className="mb-8 px-5">
                    <MenuItem
                        icon={Eye}
                        label="Privacy e Visibilità"
                        color={Colors.success}
                    />
                    <MenuItem
                        icon={LifeBuoy}
                        label="Centro Assistenza"
                        color="#ef4444"
                    />
                    <MenuItem
                        icon={FileText}
                        label="Termini e Condizioni"
                        color={Colors.primary}
                        last
                    />
                </SoftCard>

                {/* Esci dall'account - styled like other menu items */}
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
                            <Text className="text-red-500 font-bold text-base">Esci dall&apos;Account</Text>
                        </View>
                        <ChevronRight size={18} color="#fca5a5" />
                    </TouchableOpacity>
                </SoftCard>

                {/* Elimina Account */}
                <TouchableOpacity className="mb-8 items-center">
                    <Text className="text-red-400 font-bold">Elimina Account</Text>
                </TouchableOpacity>

                <View className="mb-10 items-center">
                    <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">
                        AiutarSi v{appVersion}
                    </Text>
                </View>
            </StandardLayout>

            {/* MODALS */}
            <Modal
                animationType="slide"
                presentationStyle="pageSheet"
                visible={showEditProfile}
                onRequestClose={() => setShowEditProfile(false)}
            >
                <View style={{ flex: 1 }}>
                    <EditProfileScreen onClose={() => setShowEditProfile(false)} />
                </View>
            </Modal>

            <Modal
                animationType="slide"
                presentationStyle="pageSheet"
                visible={showSecurity}
                onRequestClose={() => setShowSecurity(false)}
            >
                <View style={{ flex: 1 }}>
                    <SecurityScreen onClose={() => setShowSecurity(false)} />
                </View>
            </Modal>
        </View>
    );
}
