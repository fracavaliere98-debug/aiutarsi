import { View, Text, TouchableOpacity } from "react-native";
import { UserAvatar } from "./UserAvatar";
import { CheckCircle2 } from "lucide-react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";

import { OldApplication, OldActivityApplication } from "../types";

interface VolunteerApplicationCardProps {
    application: (OldApplication | OldActivityApplication) & { metrics?: { matchScore: number }, phone?: string };
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    showActions?: boolean;
}

export const VolunteerApplicationCard = ({
    application,
    onApprove,
    onReject,
    showActions = false
}: VolunteerApplicationCardProps) => {
    const router = useRouter();
    const { getUserById } = useAuth();
    const fullUser = getUserById(application.volunteerId);

    const handlePress = () => {
        router.push(`/(npo)/volunteer-profile/${application.volunteerId}` as any);
    };

    // Subtitle logic: Bio -> Message -> Role
    const subtitle = fullUser?.bio
        ? fullUser.bio.length > 50 ? fullUser.bio.substring(0, 50) + "..." : fullUser.bio
        : (application as any).message || "Volontario";

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={handlePress} className="mb-4">
            <View className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
                <View className="flex-row items-center gap-4 mb-4">
                    {/* Avatar & Level */}
                    <View className="relative">
                        <UserAvatar
                            size={64}
                            fontSize={20}
                            name={fullUser?.name || application.volunteerName}
                            avatarUrl={fullUser?.avatar || (application as any).volunteerAvatar}
                        />
                        {fullUser?.isVerified && (
                            <View className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                <CheckCircle2 size={16} color={Colors.success} fill="white" />
                            </View>
                        )}
                    </View>

                    {/* Main Info */}
                    <View className="flex-1">
                        <View className="flex-row justify-between items-start">
                            <View className="flex-1 mr-2">
                                <Text className="text-primary font-black text-lg leading-6">{application.volunteerName}</Text>
                                <View className="flex-row items-center gap-2 mt-0.5">
                                    <Text className="text-secondary text-sm font-medium" numberOfLines={1}>
                                        {subtitle}
                                    </Text>
                                    {application.phone && (
                                        <Text className="text-primary/60 text-xs font-bold">• {application.phone}</Text>
                                    )}
                                </View>
                            </View>

                            {/* Match Score Badge */}
                            {showActions && (application as any).metrics && (
                                <View className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                    <Text className="text-primary font-bold text-xs">
                                        {(application as any).metrics.matchScore}% Match
                                    </Text>
                                </View>
                            )}
                            {/* Status Badge for History */}
                            {!showActions && (
                                <View className="bg-green-50 px-2.5 py-1 rounded-lg border border-green-100">
                                    <Text className="text-green-700 font-bold text-xs uppercase">Iscritto</Text>
                                </View>
                            )}
                        </View>

                        {/* Tags / Skills with Gray Background */}
                        {(application as any).skills && (application as any).skills.length > 0 && (
                            <View className="flex-row flex-wrap gap-2 mt-3">
                                {(application as any).skills.slice(0, 3).map((skill: string) => (
                                    <View key={skill} className="bg-gray-100 px-3 py-1 rounded-lg">
                                        <Text className="text-gray-600 font-medium text-[10px]">{skill}</Text>
                                    </View>
                                ))}
                                {(application as any).skills.length > 3 && (
                                    <View className="bg-gray-100 px-3 py-1 rounded-lg">
                                        <Text className="text-gray-600 font-medium text-[10px]">+{(application as any).skills.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {/* Actions Buttons */}
                {showActions && onApprove && onReject && (
                    <View className="flex-row gap-3 pt-2">
                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); onReject(application.id); }}
                            className="flex-1 bg-white border border-gray-200 py-2.5 rounded-xl justify-center items-center active:bg-gray-50"
                        >
                            <Text className="text-secondary font-bold text-xs">Rifiuta</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); onApprove(application.id); }}
                            className="flex-1 bg-accent py-2.5 rounded-xl flex-row justify-center items-center gap-2 shadow-sm shadow-accent/30 active:opacity-90"
                        >
                            <CheckCircle2 size={14} color="white" />
                            <Text className="text-white font-bold text-xs">Accetta</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};
