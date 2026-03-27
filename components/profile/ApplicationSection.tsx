import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Clock } from "lucide-react-native";
import { SoftCard } from "../SoftCard";
import { OldApplication } from "../../types";
import { useRouter } from "expo-router";
import { UserAvatar } from "../UserAvatar";

interface ApplicationSectionProps {
    applications: OldApplication[];
    title?: string;
    emptyStateText?: string;
    dateLabel?: "applied" | "reviewed";
    statusMode?: "pending" | "approved";
}

export function ApplicationSection({
    applications,
    title = "Le mie candidature",
    emptyStateText = "Nessuna candidatura inviata agli enti.",
    dateLabel = "applied",
    statusMode = "pending",
}: ApplicationSectionProps) {
    const router = useRouter();

    return (
        <View className="px-6 mb-8">
            <Text className="text-xl font-black text-primary mb-3">
                {title}
            </Text>
            {applications && applications.length > 0 ? (
                <View className="flex-row flex-wrap justify-between gap-y-3">
                {applications.map(app => {
                    const statusLabel = statusMode === "approved" ? "Accettata" : "In Attesa";
                    const statusClasses =
                        statusMode === "approved"
                            ? "text-emerald-700"
                            : "text-orange-700";
                    const displayDate = dateLabel === "reviewed"
                        ? (app.reviewedDate || app.appliedDate)
                        : app.appliedDate;

                    return (
                        <TouchableOpacity
                            key={app.id}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/npo-profile/${app.npoId}` as any)}
                            style={{ width: "48.5%" }}
                        >
                            <SoftCard className="p-3 min-h-[118px] justify-center">
                                <View className="flex-row items-center">
                                    <UserAvatar
                                        size={52}
                                        fontSize={18}
                                        name={app.npoName}
                                        avatarUrl={app.npoAvatar}
                                        role="NPO"
                                    />
                                    <View className="flex-1 ml-3">
                                        <Text className="font-bold text-primary text-sm" numberOfLines={2}>
                                            {app.npoName}
                                        </Text>
                                        <Text className={`text-[11px] font-bold mt-1 ${statusClasses}`}>
                                            {statusLabel}
                                        </Text>
                                        <View className="flex-row items-center gap-1 mt-1">
                                            <Clock size={11} color="#9ca3af" />
                                            <Text className="text-gray-400 text-[11px]">
                                                {new Date(displayDate).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </SoftCard>
                        </TouchableOpacity>
                    );
                })}
                </View>
            ) : (
                <View className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-100 border-dashed">
                    <Text className="text-4xl mb-2 opacity-50">📬</Text>
                    <Text className="text-gray-400 font-medium text-center text-sm">
                        {emptyStateText}
                    </Text>
                </View>
            )}
        </View>
    );
}
