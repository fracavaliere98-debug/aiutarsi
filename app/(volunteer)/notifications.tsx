import { TouchableOpacity, RefreshControl, Text } from "react-native";
import { CheckCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../components/StandardLayout";
import { useNotificationsDomain } from "../../hooks/notifications/useNotificationsDomain";
import { useToast } from "../../context/ToastContext";
import { useState } from "react";
import { NotificationsFeed } from "../../components/notifications/NotificationsFeed";
import { colors } from "@/theme";

export default function NotificationsScreen() {
    const router = useRouter();
    const { notifications, markAllAsRead, openNotification, refreshNotifications } = useNotificationsDomain();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

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
                    tintColor={colors.accent}
                    colors={[colors.accent]}
                />
            }
        >
            <NotificationsFeed notifications={notifications} onOpen={openNotification} />
        </StandardLayout>
    );
}
