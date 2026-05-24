import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from "@/theme";

export const AccountDeletionAlert: React.FC = () => {
    const { user, cancelAccountDeletion } = useAuth();

    if (!user || !user.deletionRequestedAt) return null;

    const getDaysRemaining = (requestDate: string) => {
        const now = new Date();
        const reqDate = new Date(requestDate);
        const diffTime = now.getTime() - reqDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, 30 - diffDays);
    };

    const daysRemaining = getDaysRemaining(user.deletionRequestedAt);

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <AlertTriangle size={20} color="white" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Eliminazione Programmata</Text>
                    <Text style={styles.message}>
                        Il tuo account verrà rimosso definitivamente tra <Text style={styles.bold}>{daysRemaining} giorni</Text>.
                    </Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => cancelAccountDeletion()}
                activeOpacity={0.8}
            >
                <RotateCcw size={14} color={colors.primary} />
                <Text style={styles.cancelText}>Annulla richiesta</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#fee2e2',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '900',
        color: '#991b1b',
        marginBottom: 2,
    },
    message: {
        fontSize: 12,
        color: '#b91c1c',
        lineHeight: 18,
    },
    bold: {
        fontWeight: '900',
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    cancelText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.primary,
    },
});
