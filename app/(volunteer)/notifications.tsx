import { View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { Bell, CheckCircle, Info, AlertCircle, MessageCircle, CalendarClock, HeartHandshake, ChartColumnIncreasing } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../components/StandardLayout";
import { useNotifications } from "../../context/NotificationContext";
import { SoftCard } from "../../components/SoftCard";
import { EmptyState } from "../../components/EmptyState";
import { useToast } from "../../context/ToastContext";
import { useState } from "react";

export default function NotificationsScreen() {
    const router = useRouter();
    const { notifications, markAllAsRead, openNotification, refreshNotifications } = useNotifications();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

    const getNotificationIcon = (type: string, title?: string) => {
        switch (type) {
            case "ACTIVITY_UPDATE":
                return { Icon: AlertCircle, color: Colors.accent };
            case "ACTIVITY_REMINDER":
                return { Icon: CalendarClock, color: Colors.primary };
            case "REVIEW_REMINDER":
                return { Icon: HeartHandshake, color: "#db2777" };
            case "FOLLOWED_NPO_ACTIVITY":
                return { Icon: Bell, color: Colors.primary };
            case "VOLUNTEER_WEEKLY_RECAP":
                return { Icon: ChartColumnIncreasing, color: "#7c3aed" };
            case "SUCCESS":
                return { Icon: CheckCircle, color: "#22c55e" };
            case "URGENT":
                return { Icon: Bell, color: "#ef4444" };
            case "INFO":
                if (title?.startsWith("Nuovo messaggio da")) {
                    return { Icon: MessageCircle, color: Colors.primary };
                }
                return { Icon: Info, color: Colors.accent };
            default:
                if (title?.startsWith("Nuovo messaggio da")) {
                    return { Icon: MessageCircle, color: Colors.primary };
                }
                return { Icon: Info, color: Colors.accent };
        }
    };

    const formatTime = (timestamp: string) => {
        const now = new Date();
        const notifDate = new Date(timestamp);
        const diffMs = now.getTime() - notifDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Adesso";
        if (diffMins < 60) return `${diffMins} min fa`;
        if (diffHours < 24) return `${diffHours} ore fa`;
        if (diffDays === 1) return "1 giorno fa";
        return `${diffDays} giorni fa`;
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshNotifications();
            showToast('success', 'Notifiche aggiornate!');
        } catch {
            showToast('error', 'Non siamo riusciti ad aggiornare le notifiche.');
        }
        setRefreshing(false);
    };

    return (
        <StandardLayout
            label="In Tempo Reale"
            title="Le tue Notifiche"
            onBack={() => router.back()}
            rightElement={
                notifications.some(n => !n.read) ? (
                    <TouchableOpacity
                        onPress={markAllAsRead}
                        className="bg-white/20 p-2 rounded-full flex-row items-center gap-2 px-3"
                    >
                        <CheckCircle size={16} color="white" />
                        <Text className="text-white text-xs font-bold">Leggi tutte</Text>
                    </TouchableOpacity>
                ) : null
            }
            bg="bg-background-light"
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.accent}
                    colors={[Colors.accent]}
                />
            }
        >
            {notifications.length > 0 ? (
                notifications.map((notif) => {
                    const { Icon, color } = getNotificationIcon(notif.type, notif.title);
                    return (
                        <SoftCard
                            key={notif.id}
                            onPress={() => { void openNotification(notif); }}
                            className={`p-4 mb-4 flex-row items-start gap-4 rounded-2xl ${notif.read ? "opacity-60" : "border-accent/20"
                                }`}
                        >
                            <View style={{ backgroundColor: `${color}10` }} className="p-3 rounded-xl">
                                <Icon size={20} color={color} />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row justify-between items-center mb-1">
                                    <View className="flex-1 mr-4">
                                        <Text className="font-bold text-primary text-sm" numberOfLines={1}>{notif.title}</Text>
                                    </View>
                                    <Text className="text-[10px] text-secondary/50 font-medium uppercase">
                                        {formatTime(notif.timestamp)}
                                    </Text>
                                </View>
                                <Text className="text-secondary/70 text-sm leading-5">{notif.message}</Text>
                                {!notif.read && (
                                    <View className="mt-2">
                                        <View className="bg-accent/10 px-2 py-1 rounded self-start">
                                            <Text className="text-accent font-bold text-[10px]">NUOVA</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </SoftCard>
                    );
                })
            ) : (
                <EmptyState
                    emoji="🔔"
                    title="Nessuna notifica"
                    description="Ti avviseremo quando succede qualcosa di importante!"
                />
            )}
        </StandardLayout>
    );
}
