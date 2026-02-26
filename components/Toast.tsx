import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { useToast, ToastType } from '../context/ToastContext';

const { width } = Dimensions.get('window');

const getToastConfig = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                bgColor: 'bg-emerald-500',
                icon: CheckCircle2,
                iconColor: 'white',
            };
        case 'error':
            return {
                bgColor: 'bg-red-500',
                icon: XCircle,
                iconColor: 'white',
            };
        case 'warning':
            return {
                bgColor: 'bg-amber-500',
                icon: AlertTriangle,
                iconColor: 'white',
            };
        case 'info':
        default:
            return {
                bgColor: 'bg-blue-500',
                icon: Info,
                iconColor: 'white',
            };
    }
};

export const ToastContainer: React.FC = () => {
    const { toasts, hideToast } = useToast();

    return (
        <View className="absolute top-20 left-0 right-0 z-50 px-4" pointerEvents="box-none">
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    id={toast.id}
                    type={toast.type}
                    message={toast.message}
                    onDismiss={hideToast}
                />
            ))}
        </View>
    );
};

interface ToastItemProps {
    id: string;
    type: ToastType;
    message: string;
    onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ id, type, message, onDismiss }) => {
    const slideAnim = React.useRef(new Animated.Value(-100)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    const config = getToastConfig(type);
    const Icon = config.icon;

    useEffect(() => {
        // Slide down and fade in
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleDismiss = () => {
        // Slide up and fade out
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss(id);
        });
    };

    return (
        <Animated.View
            style={{
                transform: [{ translateY: slideAnim }],
                opacity: opacityAnim,
                marginBottom: 8,
            }}
        >
            <View className={`${config.bgColor} rounded-2xl shadow-lg flex-row items-center p-4 mx-auto`} style={{ maxWidth: width - 32 }}>
                <Icon size={24} color={config.iconColor} />
                <Text className="text-white font-semibold text-sm flex-1 ml-3" numberOfLines={2}>
                    {message}
                </Text>
                <TouchableOpacity onPress={handleDismiss} className="ml-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={20} color="white" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};
