import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from "react";
import { useRouter, useSegments } from "expo-router";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";
import { supabase } from "../utils/supabase";
import { useToast } from "./ToastContext";

export interface AppNotification {
    id: string;
    type: "ACTIVITY_UPDATE" | "SUCCESS" | "INFO" | "URGENT" | "VOLUNTEER_ENROLLED" | "APPLICATION_RECEIVED" | "APPLICATION_APPROVED" | "APPLICATION_REJECTED" | "SKILL_MATCH" | "GAMIFICATION_REMIND" | "BADGE_UNLOCKED" | "CHAT_MESSAGE" | "ACTIVITY_REMINDER" | "REVIEW_REMINDER" | "FOLLOWED_NPO_ACTIVITY" | "FOLLOWED_NPO_POST" | "FOLLOWED_NPO_STORY" | "NPO_WEEKLY_RECAP" | "VOLUNTEER_WEEKLY_RECAP" | "NPO_LOW_COVERAGE";
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
    openNotification: (notification: Pick<AppNotification, "id" | "type" | "activityId" | "applicationId" | "npoId" | "conversationId">) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter();
    const segments = useSegments();
    const { user } = useAuth();
    const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
    const { showToast } = useToast();
    const handledResponseIds = useRef<Set<string>>(new Set());
    const segmentKey = segments.join('/');
    const isQuietRoute = [
        '(volunteer)/settings',
        '(volunteer)/privacy',
        '(volunteer)/interests-skills',
        'blocked-users',
        '(volunteer)/referral',
        'help-center',
        '(npo)/settings',
        '(npo)/settings/privacy',
        '(npo)/edit-profile',
    ].some((route) => segmentKey.includes(route));

    const resolveNotificationRoute = useCallback((notif: Pick<AppNotification, "type" | "activityId" | "applicationId" | "npoId" | "conversationId">) => {
        switch (notif.type) {
            case 'CHAT_MESSAGE':
                return notif.conversationId ? `/messages/${notif.conversationId}` : '/messages';
            case 'APPLICATION_RECEIVED':
                return '/(npo)/(tabs)/volunteers';
            case 'VOLUNTEER_ENROLLED':
            case 'SKILL_MATCH':
            case 'ACTIVITY_UPDATE':
            case 'ACTIVITY_REMINDER':
            case 'REVIEW_REMINDER':
            case 'FOLLOWED_NPO_ACTIVITY':
            case 'APPLICATION_APPROVED':
            case 'APPLICATION_REJECTED':
                return notif.activityId
                    ? `/activity/${notif.activityId}`
                    : user?.role === 'NPO'
                        ? '/(npo)/(tabs)/community'
                        : '/(volunteer)/(tabs)/community';
            case 'BADGE_UNLOCKED':
            case 'GAMIFICATION_REMIND':
                return user?.role === 'NPO'
                    ? '/(npo)/(tabs)/profile'
                    : '/(volunteer)/(tabs)/profile';
            case 'NPO_WEEKLY_RECAP':
                return '/(npo)/report';
            case 'VOLUNTEER_WEEKLY_RECAP':
                return '/(volunteer)/report';
            case 'NPO_LOW_COVERAGE':
                return notif.activityId ? `/activity/${notif.activityId}` : '/(npo)/report';
            case 'FOLLOWED_NPO_POST':
            case 'FOLLOWED_NPO_STORY':
                return user?.role === 'NPO'
                    ? '/(npo)/(tabs)/community'
                    : '/(volunteer)/(tabs)/community';
            default:
                if (notif.activityId) {
                    return `/activity/${notif.activityId}`;
                }
                return user?.role === 'NPO'
                    ? '/(npo)/notifications'
                    : '/(volunteer)/notifications';
        }
    }, [user?.role]);

    // Load notifications from Supabase
    useEffect(() => {
        if (isQuietRoute) return;
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
            }
        };

        fetchNotifications();
    }, [user, isQuietRoute]);

    // Supabase Realtime Listener
    useEffect(() => {
        if (isQuietRoute) return;
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
                        onPress: () => {
                            void openNotification(newNotif);
                        }
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const updated = payload.new;
                    setAllNotifications(prev => 
                        prev.map(n => n.id === updated.id ? { ...n, read: updated.read } : n)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, openNotification, showToast, isQuietRoute]);

    const addNotification = useCallback(async (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => {
        if (!user) return;

        const targetUserId = notification.userId || user.id;

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

            const { error } = await supabase
                .from('notifications')
                .insert(payload);

            if (error) throw error;
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

    const openNotification = useCallback(async (notif: Pick<AppNotification, "id" | "type" | "activityId" | "applicationId" | "npoId" | "conversationId">) => {
        if (notif.id) {
            await markAsRead(notif.id);
        }

        const route = resolveNotificationRoute(notif);
        console.log('Navigating for notification:', notif.type, route);
        router.push(route as any);
    }, [markAsRead, resolveNotificationRoute, router]);

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
        if (Platform.OS === "web") {
            return;
        }

        const normalizeNotificationType = (rawType: unknown): AppNotification['type'] => {
            const normalized = String(rawType || 'INFO').trim().toUpperCase();
            if (normalized === 'CHAT_MESSAGE') return 'CHAT_MESSAGE';
            if (normalized === 'ACTIVITY_UPDATE') return 'ACTIVITY_UPDATE';
            if (normalized === 'SUCCESS') return 'SUCCESS';
            if (normalized === 'INFO') return 'INFO';
            if (normalized === 'URGENT') return 'URGENT';
            if (normalized === 'VOLUNTEER_ENROLLED') return 'VOLUNTEER_ENROLLED';
            if (normalized === 'APPLICATION_RECEIVED') return 'APPLICATION_RECEIVED';
            if (normalized === 'APPLICATION_APPROVED') return 'APPLICATION_APPROVED';
            if (normalized === 'APPLICATION_REJECTED') return 'APPLICATION_REJECTED';
            if (normalized === 'SKILL_MATCH') return 'SKILL_MATCH';
            if (normalized === 'GAMIFICATION_REMIND') return 'GAMIFICATION_REMIND';
            if (normalized === 'BADGE_UNLOCKED') return 'BADGE_UNLOCKED';
            if (normalized === 'ACTIVITY_REMINDER') return 'ACTIVITY_REMINDER';
            if (normalized === 'REVIEW_REMINDER') return 'REVIEW_REMINDER';
            if (normalized === 'FOLLOWED_NPO_ACTIVITY') return 'FOLLOWED_NPO_ACTIVITY';
            if (normalized === 'FOLLOWED_NPO_POST') return 'FOLLOWED_NPO_POST';
            if (normalized === 'FOLLOWED_NPO_STORY') return 'FOLLOWED_NPO_STORY';
            if (normalized === 'NPO_WEEKLY_RECAP') return 'NPO_WEEKLY_RECAP';
            if (normalized === 'VOLUNTEER_WEEKLY_RECAP') return 'VOLUNTEER_WEEKLY_RECAP';
            if (normalized === 'NPO_LOW_COVERAGE') return 'NPO_LOW_COVERAGE';
            return 'INFO';
        };

        const mapResponseToNotification = (response: any) => {
            const request = response.notification.request;
            const data = request.content.data ?? {};

            return {
                id: String((data as any).notificationId || request.identifier || ''),
                type: normalizeNotificationType((data as any).type),
                activityId: (data as any).activityId || (data as any).related_activity_id,
                applicationId: (data as any).applicationId || (data as any).related_application_id,
                npoId: (data as any).npoId || (data as any).related_npo_id,
                conversationId: (data as any).conversationId || (data as any).related_conversation_id,
            };
        };

        const handleResponse = async (response: any | null) => {
            if (!response) return;

            const responseId = response.notification.request.identifier;
            if (handledResponseIds.current.has(responseId)) {
                return;
            }

            handledResponseIds.current.add(responseId);
            await openNotification(mapResponseToNotification(response));
        };

        let isMounted = true;
        let notificationListener: { remove: () => void } | null = null;
        let responseListener: { remove: () => void } | null = null;

        void import("expo-notifications")
            .then((Notifications) => {
                if (!isMounted) return;

                notificationListener = Notifications.addNotificationReceivedListener(event => {
                    console.log('Notification received in foreground (Expo):', event.request.content.data);
                });

                responseListener = Notifications.addNotificationResponseReceivedListener(response => {
                    void handleResponse(response);
                });

                void Notifications.getLastNotificationResponseAsync()
                    .then(handleResponse)
                    .finally(() => Notifications.clearLastNotificationResponseAsync().catch(() => {}));
            })
            .catch((error) => {
                console.warn("[Push] Notification listeners unavailable:", error);
            });

        return () => {
            isMounted = false;
            notificationListener?.remove();
            responseListener?.remove();
        };
    }, [openNotification]);

    useEffect(() => {
        // notification handler
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
                openNotification,
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
