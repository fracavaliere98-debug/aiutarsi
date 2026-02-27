import React from "react";
import { View, Text } from "react-native";
import { User as UserIcon } from "lucide-react-native";
import { Image } from "expo-image";
import { useAuth } from "../context/AuthContext";

interface UserAvatarProps {
    size?: number;
    fontSize?: number;
    className?: string;
    name?: string;
    avatarUrl?: string;
    useAuthFallback?: boolean;
    showStatus?: boolean;
    isOnline?: boolean;
}

export function UserAvatar({
    size = 40,
    fontSize = 14,
    className,
    name,
    avatarUrl,
    useAuthFallback = false,
    showStatus = false,
    isOnline = false
}: UserAvatarProps) {
    const { user } = useAuth();

    // Use passed props, or fallback to current user ONLY if explicitly requested
    const finalName = name || (useAuthFallback ? user?.name : undefined);
    const finalAvatar = avatarUrl || (useAuthFallback ? user?.avatar : undefined);

    const getInitials = (n: string) => {
        if (!n) return "";
        return n
            .split(" ")
            .filter(Boolean)
            .map(part => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const initials = finalName ? getInitials(finalName) : "";

    return (
        <View style={{ width: size, height: size }}>
            <View
                style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}
                className={`bg-slate-200 items-center justify-center border border-white/30 ${className}`}
            >
                {finalAvatar ? (
                    <Image
                        source={{ uri: finalAvatar }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View className="items-center justify-center bg-slate-100 w-full h-full">
                        <UserIcon size={size * 0.6} color="#94a3b8" />
                    </View>
                )}
            </View>

            {showStatus && (
                <View
                    style={{
                        width: size * 0.25,
                        height: size * 0.25,
                        borderRadius: (size * 0.25) / 2,
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        borderWidth: 2,
                        borderColor: 'white'
                    }}
                    className={isOnline ? "bg-green-500" : "bg-slate-300"}
                />
            )}
        </View>
    );
}
