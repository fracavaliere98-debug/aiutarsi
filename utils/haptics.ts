import * as Haptics from 'expo-haptics';

export const triggerHaptic = {
    /**
     * Light haptic feedback for selections and minor interactions
     */
    light: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },

    /**
     * Medium haptic feedback for standard interactions
     */
    medium: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },

    /**
     * Heavy haptic feedback for important actions
     */
    heavy: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },

    /**
     * Success notification haptic
     */
    success: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },

    /**
     * Warning notification haptic
     */
    warning: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },

    /**
     * Error notification haptic
     */
    error: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },

    /**
     * Selection haptic for toggles, switches, pickers
     */
    selection: () => {
        Haptics.selectionAsync();
    },
};
