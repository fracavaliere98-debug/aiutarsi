import React from "react";
import { View, Text } from "react-native";
import { Heart, Hand } from "lucide-react-native";
import { SoftCard } from "../SoftCard";
import { getSkillLabel } from "../../constants/Skills";
import { colors } from "@/theme";

interface SkillInterestSectionProps {
    skills?: string[];
    interests?: string[];
}

export function SkillInterestSection({ skills = [], interests = [] }: SkillInterestSectionProps) {
    if (skills.length === 0 && interests.length === 0) return null;

    return (
        <View className="px-6 mb-6">
            <Text className="text-xl font-black text-primary mb-3">Competenze & Interessi</Text>
            <View className="gap-3">
                {interests.length > 0 && (
                    <SoftCard className="p-4">
                        <View className="flex-row items-center gap-2 mb-3">
                            <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent + "15" }}>
                                <Heart size={15} color={colors.accent} />
                            </View>
                            <Text className="text-primary font-bold text-sm">Cause che ti coinvolgono di più</Text>
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                            {interests.map((interest, i) => (
                                <View key={`int-${i}-${interest}`} className="bg-accent/10 px-3 py-2 rounded-xl border border-accent/10">
                                    <Text className="text-accent font-bold text-xs">{interest}</Text>
                                </View>
                            ))}
                        </View>
                    </SoftCard>
                )}

                {skills.length > 0 && (
                    <SoftCard className="p-4">
                        <View className="flex-row items-center gap-2 mb-3">
                            <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + "15" }}>
                                <Hand size={15} color={colors.primary} />
                            </View>
                            <Text className="text-primary font-bold text-sm">Cosa sai fare?</Text>
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                            {skills.map((skill, i) => (
                                <View key={`skill-${i}-${skill}`} className="bg-primary/10 px-3 py-2 rounded-xl border border-primary/10">
                                    <Text className="text-primary font-bold text-xs">{getSkillLabel(skill)}</Text>
                                </View>
                            ))}
                        </View>
                    </SoftCard>
                )}
            </View>
        </View>
    );
}
