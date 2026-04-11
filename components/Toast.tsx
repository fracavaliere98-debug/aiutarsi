import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { useToast, ToastType } from '../context/ToastContext';

const { width } = Dimensions.get('window');

const getToastConfig = (type: ToastType) => {
    switch (type) {
        case 'success':
            return { bgColor: '#10b981', icon: CheckCircle2 };
        case 'error':
            return { bgColor: '#ef4444', icon: XCircle };
        case 'warning':
            return { bgColor: '#f59e0b', icon: AlertTriangle };
        case 'info':
        default:
            return { bgColor: '#3b82f6', icon: Info };
    }
};

export const ToastContainer: React.FC = () => {
    const { toasts, hideToast } = useToast();

    return (
        <View style={{ position: 'absolute', top: 80, left: 0, right: 0, zIndex: 9999, paddingHorizontal: 16 }} pointerEvents="box-none">
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    id={toast.id}
                    type={toast.type}
                    message={toast.message}
                    action={toast.action}
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
    action?: { label: string; onPress: () => void };
    onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ id, type, message, action, onDismiss }) => {
    const slideAnim = React.useRef(new Animated.Value(-100)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    const config = getToastConfig(type);
    const Icon = config.icon;

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy < 0) {
                    // Pulling up
                    slideAnim.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy < -20 || gestureState.vy < -0.5) {
                    // Swiped up fast or far enough -> dismiss
                    handleDismiss();
                } else {
                    // Snap back
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            }
        })
    ).current;

    useEffect(() => {
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
    }, [opacityAnim, slideAnim]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onDismiss(id));
    };

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={{
                transform: [{ translateY: slideAnim }],
                opacity: opacityAnim,
                marginBottom: 8,
            }}
        >
            <View
                style={{
                    backgroundColor: config.bgColor,
                    borderRadius: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 6,
                    maxWidth: width - 32,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                }}
            >
                {/* Icon and Message */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Icon size={20} color="white" />
                    <Text
                        style={{
                            color: 'white',
                            fontWeight: '600',
                            fontSize: 14,
                            flex: 1,
                            flexShrink: 1,
                            marginLeft: 10
                        }}
                        numberOfLines={2}
                    >
                        {message}
                    </Text>
                </View>

                {/* Action button (e.g. Annulla) */}
                {action && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                        <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 12 }} />
                        <TouchableOpacity
                            onPress={() => { action.onPress(); handleDismiss(); }}
                            hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
                        >
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
                                {action.label.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Dismiss X button (only when no action, to keep it clean) */}
                {!action && (
                    <TouchableOpacity
                        onPress={handleDismiss}
                        style={{ marginLeft: 10 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={18} color="white" />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};
