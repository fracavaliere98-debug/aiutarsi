import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * usePushNotifications
 *
 * Requests push notification permission, retrieves the Expo push token,
 * and saves it to the user's profile in Supabase.
 *
 * Must be called inside a component that is under the AuthProvider.
 * The token is only refreshed when it changes (stored in a ref to avoid loops).
 */
export function usePushNotifications() {
    const { user } = useAuth();
    const hasRegistered = useRef(false);

    useEffect(() => {
        if (!user?.id || hasRegistered.current) return;

        const registerForPushNotifications = async () => {
            // Physical device required (simulators/emulators don't get real tokens)
            if (!Device.isDevice) {
                console.log('[Push] Skipping: not a physical device');
                return;
            }

            // Check/request permission
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[Push] Permission not granted by user');
                return;
            }

            // Android: requires a notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#D81B60',
                });
            }

            // Get the Expo push token
            let token: string;
            try {
                const response = await Notifications.getExpoPushTokenAsync({
                    projectId: 'b14b866c-c340-4e7d-a7ad-a6ec9a9935b3', // From app.json > expo.extra.eas.projectId
                });
                token = response.data;
            } catch (err) {
                console.error('[Push] Failed to get token:', err);
                return;
            }

            console.log('[Push] Token acquired:', token);

            // Save to Supabase profiles
            const { error } = await supabase
                .from('profiles')
                .update({
                    expo_push_token: token,
                    last_seen_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) {
                console.error('[Push] Failed to save token to DB:', error.message);
            } else {
                console.log('[Push] Token saved to DB successfully');
                hasRegistered.current = true;
            }
        };

        registerForPushNotifications();
    }, [user?.id]);

    // Update last_seen_at periodically while the app is open (marks user as "online")
    useEffect(() => {
        if (!user?.id) return;

        const updateLastSeen = async () => {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ last_seen_at: new Date().toISOString() })
                    .eq('id', user.id);
                
                if (error && !error.message.includes('FetchError') && !error.message.includes('Network request')) {
                    console.warn('[Push] last_seen_at error:', error.message);
                }
            } catch (err) {
                // Silent catch for "Network request failed" or timeout errors 
                // Since this is just a background presence ping, we don't care if it drops.
            }
        };

        // Update immediately and then every 30 seconds
        updateLastSeen();
        const interval = setInterval(updateLastSeen, 30_000);

        return () => clearInterval(interval);
    }, [user?.id]);
}
