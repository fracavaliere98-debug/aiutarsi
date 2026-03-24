import React from "react";
import { Modal, View, ModalProps, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SheetModalProps extends ModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

/**
 * SheetModal
 * A reusable modal component that enforces the "pageSheet" presentation style
 * and "slide" animation, consistent with the NPO settings screens.
 */
export function SheetModal({ visible, onClose, children, ...props }: SheetModalProps) {
    return (
        <Modal
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent={true}
            {...props}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView 
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {children}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Ensure proper background if not set by children
        backgroundColor: '#f8fafc',
    }
});
