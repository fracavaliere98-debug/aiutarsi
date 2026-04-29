import React from "react";
import { View, Text } from "react-native";
import { User as UserIcon, CheckCircle2 } from 'lucide-react-native';
import { Image } from "expo-image";
import { useAuth } from "../context/AuthContext";
import { Colors } from "../constants/Colors";
import { Role } from "../types";

interface UserAvatarProps {
    size?: number;
    fontSize?: number;
    className?: string;
    name?: string;
    avatarUrl?: string;
    useAuthFallback?: boolean;
    showStatus?: boolean;
    isOnline?: boolean;
    role?: Role;
    isVerified?: boolean;
    verificationStatus?: string;
}

export function UserAvatar({
    size = 40,
    fontSize = 14,
    className,
    name,
    avatarUrl,
    useAuthFallback = false,
    showStatus = false,
    isOnline = false,
    role,
    isVerified = false,
    verificationStatus
}: UserAvatarProps) {
    const { user } = useAuth();

    // Use passed props, or fallback to current user ONLY if explicitly requested
    const finalName = name || (useAuthFallback ? user?.name : undefined);
    const finalAvatar = avatarUrl || (useAuthFallback ? user?.avatar : undefined);
    const finalRole = role || (useAuthFallback ? user?.role : undefined);
    const finalVerificationStatus = verificationStatus || (useAuthFallback ? user?.verification_status : undefined);
    const finalIsVerified = isVerified || !!(useAuthFallback && (user?.isVerified || user?.is_verified));

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

    const isNPO = finalRole === "NPO";
    const isConfirmedVerified = isNPO && (
        finalVerificationStatus === "verified" ||
        (!finalVerificationStatus && finalIsVerified)
    );
    const isPendingVerification = isNPO && !isConfirmedVerified && finalVerificationStatus === "pending";
    const npoBorderColor = isConfirmedVerified
        ? Colors.primary
        : isPendingVerification
            ? "#2563eb"
            : "rgba(255,255,255,0.3)";

    return (
        <View style={{ width: size, height: size }}>
            <View
                style={{ 
                    width: size, 
                    height: size, 
                    borderRadius: size / 2, 
                    overflow: "hidden",
                    borderWidth: isNPO && (isConfirmedVerified || isPendingVerification) ? 2 : 1,
                    borderColor: isNPO ? npoBorderColor : 'rgba(255,255,255,0.3)'
                }}
                className={`bg-slate-200 items-center justify-center ${className}`}
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
                        {initials ? (
                            <Text
                                style={{
                                    fontSize,
                                    fontWeight: "800",
                                    color: isNPO ? Colors.primary : "#64748b",
                                }}
                            >
                                {initials}
                            </Text>
                        ) : (
                            <UserIcon size={size * 0.6} color="#94a3b8" />
                        )}
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

            {/* Verification Badge */}
            {isConfirmedVerified && (
                <View
                    style={{
                        width: size * 0.35,
                        height: size * 0.35,
                        borderRadius: (size * 0.35) / 2,
                        position: 'absolute',
                        bottom: -size * 0.05,
                        right: -size * 0.05,
                        borderWidth: 2,
                        borderColor: 'white',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: Colors.primary
                    }}
                    className="shadow-sm"
                >
                    <CheckCircle2 size={size * 0.22} color="white" />
                </View>
            )}
        </View>
    );
}
