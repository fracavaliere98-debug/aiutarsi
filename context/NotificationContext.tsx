import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";
import { supabase } from "../utils/supabase";

export interface Notification {
    id: string;
    type: "ACTIVITY_UPDATE" | "SUCCESS" | "INFO" | "URGENT" | "VOLUNTEER_ENROLLED" | "APPLICATION_RECEIVED" | "APPLICATION_APPROVED" | "APPLICATION_REJECTED";
    title: string;
    message: string;
    timestamp: string;
    activityId?: string;
    applicationId?: string;
    npoId?: string;
    read: boolean;
    userId: string;
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => Promise<void>;
    getUnreadCount: () => number;
    unreadCount: number;
    expoPushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

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

                const mapped: Notification[] = data.map((n: any) => ({
                    id: n.id,
                    userId: n.user_id,
                    type: n.type as any,
                    title: n.title,
                    message: n.message,
                    read: n.read,
                    activityId: n.related_activity_id,
                    timestamp: n.created_at
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

    const addNotification = useCallback(async (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
        if (!user) return;

        const targetUserId = notification.userId || user.id;
        const isSelfNotification = targetUserId === user.id;

        try {
            if (isSelfNotification) {
                const { data, error } = await supabase
                    .from('notifications')
                    .insert({
                        user_id: targetUserId,
                        type: notification.type,
                        title: notification.title,
                        message: notification.message,
                        related_activity_id: notification.activityId,
                        read: false
                    })
                    .select()
                    .single();

                if (error) throw error;

                const newNotif: Notification = {
                    id: data.id,
                    userId: data.user_id,
                    type: data.type as any,
                    title: data.title,
                    message: data.message,
                    read: data.read,
                    activityId: data.related_activity_id,
                    timestamp: data.created_at
                };

                setAllNotifications(prev => [newNotif, ...prev]);

            } else {
                const { error } = await supabase
                    .from('notifications')
                    .insert({
                        user_id: targetUserId,
                        type: notification.type,
                        title: notification.title,
                        message: notification.message,
                        related_activity_id: notification.activityId,
                        read: false
                    });

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
        return allNotifications.filter((n: Notification) => n.userId === user.id);
    }, [user, allNotifications]);

    const unreadCount = useMemo(() => {
        return userNotifications.filter(n => !n.read).length;
    }, [userNotifications]);

    const getUnreadCount = useCallback(() => unreadCount, [unreadCount]);

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

