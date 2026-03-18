import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "./AuthContext";
import { supabase } from "../utils/supabase";
import { useToast } from "./ToastContext";

export interface AppNotification {
    id: string;
    type: "ACTIVITY_UPDATE" | "SUCCESS" | "INFO" | "URGENT" | "VOLUNTEER_ENROLLED" | "APPLICATION_RECEIVED" | "APPLICATION_APPROVED" | "APPLICATION_REJECTED" | "SKILL_MATCH" | "GAMIFICATION_REMIND" | "BADGE_UNLOCKED" | "CHAT_MESSAGE";
    title: string;
    message: string;
    timestamp: string;
    activityId?: string;
    applicationId?: string;
    npoId?: string;
    conversationId?: string;
    read: boolean;
    userId: string;
    matchScore?: number;
}

interface NotificationContextType {
    notifications: AppNotification[];
    addNotification: (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => Promise<void>;
    getUnreadCount: () => number;
    unreadCount: number;
    expoPushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter();
    const { user } = useAuth();
    const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const { showToast } = useToast();

    // Mapping function for notification navigation
    const handleNotificationPress = useCallback((notif: AppNotification) => {
        console.log("Navigating for notification type:", notif.type, notif.activityId, notif.conversationId);
        
        switch (notif.type) {
            case 'SKILL_MATCH':
            case 'ACTIVITY_UPDATE':
            case 'APPLICATION_APPROVED':
                if (notif.activityId) {
                    router.push(`/(volunteer)/activity/${notif.activityId}` as any);
                } else {
                    router.push('/(volunteer)/(tabs)/home' as any);
                }
                break;
            case 'CHAT_MESSAGE':
                if (notif.conversationId) {
                    router.push(`/(shared)/chat/${notif.conversationId}` as any);
                } else {
                    router.push('/(shared)/chat' as any);
                }
                break;
            case 'GAMIFICATION_REMIND':
            case 'BADGE_UNLOCKED':
                router.push('/(volunteer)/(tabs)/profile' as any);
                break;
            default:
                // Default fallback
                if (notif.activityId) {
                    router.push(`/(volunteer)/activity/${notif.activityId}` as any);
                } else {
                    router.push('/(volunteer)/(tabs)/profile' as any);
                }
        }
    }, [router]);

    // 1. Handle Push Token Registration
    useEffect(() => {
        if (!user) return;

        const registerForPush = async () => {
            try {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    setExpoPushToken(token);
                    // Save to Supabase
                    await supabase
                        .from('profiles')
                        .update({ expo_push_token: token })
                        .eq('id', user.id);
                }
            } catch (error) {
                console.error("Error registering for push notifications:", error);
            }
        };

        registerForPush();
    }, [user?.id]);

    // Load notifications from Supabase
    useEffect(() => {
        if (!user) {
            setAllNotifications([]);
            return;
        }

        const fetchNotifications = async () => {
            try {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                const mapped: AppNotification[] = data.map((n: any) => ({
                    id: n.id,
                    userId: n.user_id,
                    type: n.type as any,
                    title: n.title,
                    message: n.message,
                    read: n.read,
                    activityId: n.related_activity_id,
                    conversationId: n.related_conversation_id,
                    timestamp: n.created_at,
                    matchScore: n.match_score
                }));

                setAllNotifications(mapped);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setIsInitialLoad(false);
            }
        };

        fetchNotifications();
    }, [user?.id]);

    // Supabase Realtime Listener
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const n = payload.new;
                    const newNotif: AppNotification = {
                        id: n.id,
                        userId: n.user_id,
                        type: n.type as any,
                        title: n.title,
                        message: n.message,
                        read: n.read,
                        activityId: n.related_activity_id,
                        conversationId: n.related_conversation_id,
                        timestamp: n.created_at,
                        matchScore: n.match_score
                    };

                    setAllNotifications(prev => [newNotif, ...prev]);

                    // Show Foreground Toast with custom logic
                    showToast('info', `${newNotif.title}: ${newNotif.message}`, 6000, {
                        label: "VEDI",
                        onPress: () => handleNotificationPress(newNotif)
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, handleNotificationPress]);

    const addNotification = useCallback(async (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => {
        if (!user) return;

        const targetUserId = notification.userId || user.id;
        const isSelfNotification = targetUserId === user.id;

        try {
            const payload = {
                user_id: targetUserId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                related_activity_id: notification.activityId,
                related_conversation_id: notification.conversationId,
                match_score: notification.matchScore,
                read: false
            };

            if (isSelfNotification) {
                const { data, error } = await supabase
                    .from('notifications')
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    const newNotif: AppNotification = {
                        id: data.id,
                        userId: data.user_id,
                        type: data.type as any,
                        title: data.title,
                        message: data.message,
                        read: data.read,
                        activityId: data.related_activity_id,
                        conversationId: data.related_conversation_id,
                        timestamp: data.created_at,
                        matchScore: data.match_score
                    };

                    setAllNotifications(prev => [newNotif, ...prev]);
                }
            } else {
                const { error } = await supabase
                    .from('notifications')
                    .insert(payload);

                if (error) throw error;
            }
        } catch (error) {
            console.error("Error adding notification:", error);
        }
    }, [user]);

    const markAsRead = useCallback(async (notificationId: string) => {
        setAllNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId);

            if (error) throw error;
        } catch (e) {
            console.error("Failed to mark notification as read", e);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!user) return;

        setAllNotifications(prev =>
            prev.map(n => n.userId === user.id ? { ...n, read: true } : n)
        );

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (error) throw error;
        } catch (e) {
            console.error("Failed to mark all as read", e);
        }
    }, [user]);

    const clearAll = useCallback(async () => {
        if (!user) return;

        setAllNotifications([]);

        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
        } catch (e) {
            console.error("Failed to clear notifications", e);
        }
    }, [user]);

    const userNotifications = useMemo(() => {
        if (!user) return [];
        return allNotifications.filter((n: AppNotification) => n.userId === user.id);
    }, [user, allNotifications]);

    const unreadCount = useMemo(() => {
        return userNotifications.filter(n => !n.read).length;
    }, [userNotifications]);

    const getUnreadCount = useCallback(() => unreadCount, [unreadCount]);

    // 2. Register Notification Listeners
    useEffect(() => {
        // This listener is fired whenever a notification is received while the app is foregrounded
        const notificationListener = Notifications.addNotificationReceivedListener(event => {
            console.log('Notification received in foreground (Expo):', event);
            
            // Only show toast if it's NOT coming from our Supabase listener to avoid duplicates
            // Most push notifications will also have a DB record, but some might be raw
            const data = event.request.content.data;
            
            // If we don't have a specific way to deduplicate, we might show both, 
            // but usually Realtime is faster.
            // Let's check if this specific interaction has already been shown
        });

        // This listener is fired whenever a user taps on or interacts with a notification 
        // (works when app is foreground, background, or killed)
        const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log('Notification interaction:', data);

            // Mapped navigation logic for Expo Notifications
            const notif: any = {
                type: data?.type || 'INFO',
                activityId: data?.activityId || data?.related_activity_id,
                conversationId: data?.conversationId || data?.related_conversation_id,
            };

            handleNotificationPress(notif);
        });

        return () => {
            notificationListener.remove();
            responseListener.remove();
        };
    }, [handleNotificationPress]);

    useEffect(() => {
        // Global configuration for how notifications should behave when the app is in foreground
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: false, // User requested only Toast in foreground
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: false,
                shouldShowList: true,
            }),
        });
    }, []);

    return (
        <NotificationContext.Provider
            value={{
                notifications: userNotifications,
                addNotification,
                markAsRead,
                markAllAsRead,
                clearAll,
                getUnreadCount,
                unreadCount,
                expoPushToken,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within NotificationProvider");
    }
    return context;
};

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        token = (await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        })).data;
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

