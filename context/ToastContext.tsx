import React, { createContext, useContext, useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: ToastMessage[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
    toasts: [],
    showToast: () => { },
    hideToast: () => { },
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((type: ToastType, message: string, duration: number = 3000) => {
        const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

        // Trigger haptic feedback based on toast type
        switch (type) {
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            case 'info':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
        }

        const newToast: ToastMessage = { id, type, message, duration };
        setToasts(prev => [...prev, newToast]);

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                hideToast(id);
            }, duration);
        }
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
            {children}
        </ToastContext.Provider>
    );
};
