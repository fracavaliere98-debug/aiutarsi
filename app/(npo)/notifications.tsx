import { TouchableOpacity, RefreshControl, Text } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useNotificationsDomain } from "../../hooks/notifications/useNotificationsDomain";
import { StandardLayout } from "../../components/StandardLayout";
import { CheckCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useToast } from "../../context/ToastContext";
import { NotificationsFeed } from "../../components/notifications/NotificationsFeed";
import { colors } from "@/theme";

export default function NPONotificationsScreen() {
    const { user } = useAuth();
    const { notifications, markAllAsRead, openNotification, refreshNotifications } = useNotificationsDomain();
    const router = useRouter();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

    // Filter notifications for current NPO user
    const myNotifications = notifications
        .filter(n => n.userId === user?.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
                    tintColor={colors.accent}
                    colors={[colors.accent]}
                />
            }
        >
            <NotificationsFeed notifications={myNotifications} onOpen={openNotification} />
        </StandardLayout>
    );
}
