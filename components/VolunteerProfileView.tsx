import React from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import { Settings } from "lucide-react-native";
import { StandardLayout } from "./StandardLayout";
import { User , Application } from "../types";

import { ProfileHeader } from "./profile/ProfileHeader";
import { ProfileStats } from "./profile/ProfileStats";
import { BadgeSection } from "./profile/BadgeSection";
import { ApplicationSection } from "./profile/ApplicationSection";
import { NPOAffiliationSection } from "./profile/NPOAffiliationSection";
import { SkillInterestSection } from "./profile/SkillInterestSection";

// Prop Types
interface Badge {
    id: string;
    name: string;
    icon: string;
    description: string;
    dateEarned: string;
    color: string;
}

interface GamificationState {
    totalXP: number;
    level: number;
    badges: Badge[];
}

interface VolunteerStats {
    totalHours: number;
    completedMissions: number;
    rating: number;
}

interface VolunteerProfileViewProps {
    user: User | null;
    gamificationState: GamificationState;
    stats: VolunteerStats;
    levelProgress: number;
    xpInLevel: number;
    xpNeededForLevel: number;
    isOwnProfile?: boolean;
    onSettingsPress?: () => void;
    onBack?: () => void;
    followedNPOs?: User[];
    affiliatedNPOs: User[];
    npoApplications: Application[];
    children?: React.ReactNode;
}

export function VolunteerProfileView({
    user,
    gamificationState,
    stats,
    levelProgress,
    xpInLevel,
    xpNeededForLevel,
    isOwnProfile = false,
    onSettingsPress,
    onBack,
    followedNPOs,
    affiliatedNPOs = [],
    npoApplications = [],
    children
}: VolunteerProfileViewProps) {
    const HeaderActions = isOwnProfile ? (
        <TouchableOpacity
            onPress={onSettingsPress}
            className="bg-white/10 p-2.5 rounded-xl border border-white/20"
        >
            <Settings size={20} color="white" />
        </TouchableOpacity>
    ) : null;

    return (
        <StandardLayout
            label={isOwnProfile ? "Il tuo Profilo" : "Profilo Volontario"}
            title={isOwnProfile ? "Profilo" : (user?.name || "Volontario")}
            rightElement={HeaderActions}
            bg="bg-white"
            noPadding
            onBack={onBack}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* 1. Header Section */}
                <ProfileHeader
                    user={user}
                    level={gamificationState.level}
                    isOwnProfile={isOwnProfile}
                    onSettingsPress={onSettingsPress}
                />

                {/* 2. Stats & Level Section */}
                <ProfileStats
                    level={gamificationState.level}
                    totalXP={gamificationState.totalXP}
                    xpInLevel={xpInLevel}
                    xpNeededForLevel={xpNeededForLevel}
                    levelProgress={levelProgress}
                    stats={{
                        totalHours: stats.totalHours,
                        completedMissions: stats.completedMissions,
                        rating: stats.rating
                    }}
                    userId={user?.id || ''}
                    isOwnProfile={isOwnProfile}
                />

                {/* 3. Skills & Interests */}
                <SkillInterestSection
                    skills={user?.skills}
                    interests={user?.interests}
                />

                {/* 4. Badges Section */}
                <BadgeSection badges={gamificationState.badges} />

                {/* 5. NPO Applications (Own profile only) */}
                {isOwnProfile && <ApplicationSection applications={npoApplications} />}

                {/* 6. Affiliations & Following */}
                <NPOAffiliationSection
                    isOwnProfile={isOwnProfile}
                    affiliatedNPOs={affiliatedNPOs}
                    followedNPOs={followedNPOs}
                />

                {children}
            </ScrollView>
        </StandardLayout >
    );
};
