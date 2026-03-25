import React from "react";
import { View, Text } from "react-native";

interface SkillInterestSectionProps {
    skills?: string[];
    interests?: string[];
}

export function SkillInterestSection({ skills = [], interests = [] }: SkillInterestSectionProps) {
    if (skills.length === 0 && interests.length === 0) return null;

    return (
        <View className="px-6 mb-6">
            <Text className="text-xl font-black text-primary mb-3">Competenze & Interessi</Text>
            <View className="flex-row flex-wrap gap-2">
                {skills.map((skill, i) => (
                    <View key={`skill-${i}-${skill}`} className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10">
                        <Text className="text-primary font-bold text-xs">{skill}</Text>
                    </View>
                ))}
                {interests.map((interest, i) => (
                    <View key={`int-${i}-${interest}`} className="bg-accent/10 px-3 py-1.5 rounded-xl border border-accent/10">
                        <Text className="text-accent font-bold text-xs">{interest}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
