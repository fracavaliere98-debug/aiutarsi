import { View, Text, TouchableOpacity } from "react-native";
import { UserAvatar } from "./UserAvatar";
import { User } from "../types";
import { Colors } from "../constants/Colors";
import { Mail, Award } from "lucide-react-native";
import { SoftCard } from "./SoftCard";
import { useState, useEffect } from "react";
import { getUserGamificationState } from "../context/GamificationContext";
import { useRouter } from "expo-router";

interface CompactFollowerCardProps {
    volunteer: User;
    onInvite: (volunteerId: string) => void;
}

export function CompactFollowerCard({ volunteer, onInvite }: CompactFollowerCardProps) {
    const [level, setLevel] = useState<number | null>(null);
    const router = useRouter();

    useEffect(() => {
        getUserGamificationState(volunteer.id).then(state => {
            setLevel(state.level);
        });
    }, [volunteer.id]);

    // Show top 2 skills
    const displaySkills = volunteer.skills.slice(0, 2);

    const handlePress = () => {
        router.push(`/(npo)/volunteer-profile/${volunteer.id}` as any);
    };

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
            <SoftCard className="flex-row items-center p-3 mb-2">
                <View className="relative">
                    <UserAvatar
                        size={40}
                        name={volunteer.name}
                        avatarUrl={volunteer.avatar}
                    />
                    {level !== null && (
                        <View className="absolute -bottom-1 -right-1 bg-accent px-1.5 py-0.5 rounded-full border border-white flex-row items-center">
                            <Text className="text-[8px] font-bold text-white">Lv.{level}</Text>
                        </View>
                    )}
                </View>

                <View className="flex-1 ml-3">
                    <Text className="font-bold text-primary text-sm">{volunteer.name}</Text>
                    {displaySkills.length > 0 && (
                        <Text className="text-xs text-secondary mt-0.5">
                            {displaySkills.join(' • ')}
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => onInvite(volunteer.id)}
                    className="bg-accent/10 p-2.5 rounded-xl active:scale-95"
                >
                    <Mail size={18} color={Colors.accent} />
                </TouchableOpacity>
            </SoftCard>
        </TouchableOpacity>
    );
}
