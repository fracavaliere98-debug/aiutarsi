import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Clock } from "lucide-react-native";
import { SoftCard } from "../SoftCard";
import { OldApplication } from "../../types";
import { useRouter } from "expo-router";

interface ApplicationSectionProps {
    applications: OldApplication[];
}

export function ApplicationSection({ applications }: ApplicationSectionProps) {
    const router = useRouter();

    return (
        <View className="px-6 mb-8">
            <Text className="text-xl font-black text-primary mb-3">
                Le Mie OldCandidature
            </Text>
            {applications && applications.length > 0 ? (
                applications.map(app => {
                    const statusLabel = app.status === "APPROVED" ? "Accettata" :
                        app.status === "REJECTED" ? "Rifiutata" : "In Attesa";

                    return (
                        <TouchableOpacity
                            key={app.id}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/npo-profile/${app.npoId}` as any)}
                        >
                            <SoftCard className="p-4 mb-3">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="flex-1 mr-2">
                                        <Text className="font-bold text-primary text-base" numberOfLines={1}>{app.npoName}</Text>
                                        <Text className="text-secondary text-xs">Candidatura spontanea</Text>
                                    </View>
                                    <View className={`px-2 py-1 rounded-full ${app.status === "APPROVED" ? "bg-emerald-100" : app.status === "REJECTED" ? "bg-red-100" : "bg-orange-100"}`}>
                                        <Text className={`text-[10px] font-bold ${app.status === "APPROVED" ? "text-emerald-700" : app.status === "REJECTED" ? "text-red-700" : "text-orange-700"}`}>
                                            {statusLabel}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <Clock size={12} color="#9ca3af" />
                                    <Text className="text-gray-400 text-xs">Inviata il {new Date(app.appliedDate).toLocaleDateString()}</Text>
                                </View>
                            </SoftCard>
                        </TouchableOpacity>
                    );
                })
            ) : (
                <View className="bg-gray-50 rounded-2xl p-6 items-center border border-gray-100 border-dashed">
                    <Text className="text-4xl mb-2 opacity-50">📬</Text>
                    <Text className="text-gray-400 font-medium text-center text-sm">
                        Nessuna candidatura inviata agli enti.
                    </Text>
                </View>
            )}
        </View>
    );
}
