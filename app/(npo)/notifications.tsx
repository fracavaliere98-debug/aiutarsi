import { View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { StandardLayout } from "../../components/StandardLayout";
import { SoftCard } from "../../components/SoftCard";
import { EmptyState } from "../../components/EmptyState";
import { CheckCircle, AlertCircle, Info, Users, Calendar, FileText, MessageCircle, ChartColumnIncreasing, BellRing } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useToast } from "../../context/ToastContext";

export default function NPONotificationsScreen() {
    const { user } = useAuth();
    const { notifications, markAllAsRead, openNotification } = useNotifications();
    const router = useRouter();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

    // Filter notifications for current NPO user
    const myNotifications = notifications
        .filter(n => n.userId === user?.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const getNotificationIcon = (type: string, title?: string) => {
        switch (type) {
            case "VOLUNTEER_ENROLLED":
                return { Icon: Users, color: Colors.accent };
            case "APPLICATION_RECEIVED":
                return { Icon: FileText, color: Colors.primary };
            case "SUCCESS":
                return { Icon: CheckCircle, color: "#22c55e" };
            case "URGENT":
                return { Icon: AlertCircle, color: "#ef4444" };
            case "ACTIVITY_UPDATE":
                return { Icon: Calendar, color: Colors.primary };
            case "NPO_WEEKLY_RECAP":
                return { Icon: ChartColumnIncreasing, color: Colors.primary };
            case "NPO_LOW_COVERAGE":
                return { Icon: BellRing, color: "#ea580c" };
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        showToast('success', 'Notifiche aggiornate!');
        setRefreshing(false);
    };

    return (
        <StandardLayout
            label="In Tempo Reale"
            title="Centro Notifiche"
            onBack={() => router.back()}
            rightElement={
                myNotifications.some(n => !n.read) ? (
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
            {myNotifications.length > 0 ? (
                myNotifications.map((notif) => {
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
