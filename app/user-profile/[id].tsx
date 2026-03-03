import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { User } from "../../types";

/**
 * Generic profile screen for users found from chat (participants or header avatar).
 * Loads the user by ID and redirects to the correct role-specific profile page.
 * This avoids needing to know the role upfront when navigating from chat.
 */
export default function UserProfileRedirect() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { users, getUserById } = useAuth();

    const [targetUser, setTargetUser] = useState<User | null | undefined>(undefined); // undefined = loading

    useEffect(() => {
        if (!id) { setTargetUser(null); return; }

        // Try in-memory cache first
        const cached = users.find(u => u.id === id);
        if (cached) {
            setTargetUser(cached);
            return;
        }

        // Fallback: look up by ID via auth context
        const found = getUserById?.(id);
        setTargetUser(found || null);
    }, [id, users]);

    if (targetUser === undefined) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#D81B60" />
            </View>
        );
    }

    if (!targetUser) {
        // User not found — go back
        router.back();
        return null;
    }

    // Redirect based on role
    if (targetUser.role === 'NPO') {
        return <Redirect href={`/npo-profile/${id}` as any} />;
    }

    // VOLUNTEER or CORPORATE: route to the generic volunteer profile view
    return <Redirect href={`/(npo)/volunteer-profile/${id}` as any} />;
}
