import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ShieldBan, Unlock } from "lucide-react-native";
import * as Updates from 'expo-updates';
import { supabase } from "../utils/supabase";
import { useAuth } from "../context/AuthContext";
import { StandardLayout } from "../components/StandardLayout";
import { SoftCard } from "../components/SoftCard";
import { UserAvatar } from "../components/UserAvatar";
import { useToast } from "../context/ToastContext";
import { authService } from "../services/AuthService";
import { colors } from "@/theme";

interface BlockedUser {
    id: string; // block id
    blocked_id: string;
    profile: {
        id: string;
        full_name?: string | null;
        npo_name?: string | null;
        avatar_url?: string | null;
        role?: string | null;
    } | null;
}

export default function BlockedUsersScreen() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

    useEffect(() => {
        console.log("[DEBUG] BlockedUsers: screen mounted", { userId: user?.id });
    }, [user?.id]);

    const fetchBlockedUsers = useCallback(async () => {
        if (!user?.id) {
            console.log("[DEBUG] BlockedUsers: user not ready, skipping fetch");
            setBlockedUsers([]);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        try {
            console.log("[DEBUG] BlockedUsers: fetching for", user.id);
            const profiles = await authService.getBlockedUsers(user.id);

            console.log("[DEBUG] BlockedUsers: fetched", profiles.length);
            setBlockedUsers(profiles);
        } catch (error: any) {
            console.error("Error fetching blocked users:", error);
            showToast('error', 'Errore nel caricamento degli utenti bloccati');
        } finally {
            console.log("[DEBUG] BlockedUsers: fetch completed");
            setIsLoading(false);
        }
    }, [showToast, user?.id]);

    useEffect(() => {
        fetchBlockedUsers();
    }, [fetchBlockedUsers]);

    const handleUnblock = async (blockId: string, blockedName: string) => {
        Alert.alert(
            "Sblocca Utente",
            `Vuoi davvero sbloccare ${blockedName}?`,
            [
                { text: "Annulla", style: "cancel" },
                {
                    text: "Sblocca",
                    style: "destructive",
                    onPress: async () => {
                        setIsActionLoading(blockId);
                        try {
                            const { error } = await supabase
                                .from('blocked_users')
                                .delete()
                                .eq('id', blockId);

                            if (error) throw error;
                            
                            setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
                            showToast('success', `${blockedName} sbloccato. Riavvio in corso...`);
                            
                            // Forzare il ricaricamento dell'app per aggiornare tutti i contesti (Chat, Community, Feed)
                            setTimeout(async () => {
                                try {
                                    await Updates.reloadAsync();
                                } catch (e) {
                                    console.error("Reload failed:", e);
                                }
                            }, 1500);
                        } catch (error: any) {
                            console.error("Error unblocking user:", error.message);
                            showToast('error', 'Errore durante lo sblocco');
                        } finally {
                            setIsActionLoading(null);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: BlockedUser }) => {
        const displayName = item.profile?.npo_name || item.profile?.full_name || "Utente";
        const roleLabel = item.profile?.role === 'NPO' ? 'Ente' : 'Volontario';

        return (
            <SoftCard className="flex-row items-center justify-between p-4 mb-3 mx-1">
                <View className="flex-row items-center flex-1">
                    <UserAvatar 
                        avatarUrl={item.profile?.avatar_url ?? undefined} 
                        name={displayName}
                        size={48} 
                    />
                    <View className="ml-3 flex-1">
                        <Text className="text-primary font-bold text-base" numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Text className="text-secondary text-xs uppercase font-bold tracking-wider">
                            {roleLabel}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => handleUnblock(item.id, displayName)}
                    disabled={!!isActionLoading}
                    activeOpacity={0.7}
                    className="bg-primary/10 px-4 py-2 rounded-xl flex-row items-center"
                    style={{ backgroundColor: colors.primary + '10' }}
                >
                    {isActionLoading === item.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Unlock size={16} color={colors.primary} className="mr-2" />
                            <Text className="font-bold text-sm" style={{ color: colors.primary }}>
                                Sblocca
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </SoftCard>
        );
    };

    return (
        <StandardLayout
            title="Account bloccati"
            label="IMPOSTAZIONI"
            onBack={() => router.back()}
            noScroll={true}
        >
            <View className="flex-1 mt-2">
                <Text className="text-secondary font-medium text-sm mb-6 px-1">
                    Questi account non potranno vederti o contattarti. Puoi sbloccarli in qualsiasi momento.
                </Text>

                {isLoading ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : blockedUsers.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-20 px-8">
                        <View className="bg-gray-50 p-6 rounded-full mb-4">
                            <ShieldBan size={48} color="#cbd5e1" />
                        </View>
                        <Text className="text-primary font-bold text-lg text-center">
                            Nessun account bloccato
                        </Text>
                        <Text className="text-secondary text-sm text-center mt-2">
                            Non hai ancora bloccato nessun utente.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={blockedUsers}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </StandardLayout>
    );
}
