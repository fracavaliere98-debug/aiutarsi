import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Settings, MessageCircle, AlertTriangle, Share2 } from "lucide-react-native";
import { StandardLayout } from "./StandardLayout";
import { AppUser, OldApplication } from "../types";

import { ProfileHeader } from "./profile/ProfileHeader";
import { ProfileStats } from "./profile/ProfileStats";
import { BadgeSection } from "./profile/BadgeSection";
import { ApplicationSection } from "./profile/ApplicationSection";
import { NPOAffiliationSection } from "./profile/NPOAffiliationSection";
import { SkillInterestSection } from "./profile/SkillInterestSection";
import { AccountDeletionAlert } from "./AccountDeletionAlert";

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
    levelName?: string;
    badges: Badge[];
}

interface VolunteerStats {
    totalHours: number;
    completedMissions: number;
    rating: number;
}

interface VolunteerProfileViewProps {
    user: AppUser | null;
    gamificationState: GamificationState;
    stats: VolunteerStats;
    levelProgress: number;
    xpInLevel: number;
    xpNeededForLevel: number;
    isOwnProfile?: boolean;
    onSettingsPress?: () => void;
    onMessagePress?: () => void;
    onReportPress?: () => void;
    onSharePress?: () => void;
    onBack?: () => void;
    followedNPOs?: AppUser[];
    affiliatedNPOs: AppUser[];
    npoApplications: OldApplication[];
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
    onMessagePress,
    onReportPress,
    onSharePress,
    onBack,
    followedNPOs,
    affiliatedNPOs = [],
    npoApplications = [],
    children
}: VolunteerProfileViewProps) {
    const HeaderActions = (
        <View className="flex-row gap-2">
            {!isOwnProfile && onMessagePress && (
                <TouchableOpacity
                    onPress={onMessagePress}
                    className="bg-white/10 p-2.5 rounded-xl border border-white/20"
                >
                    <MessageCircle size={20} color="white" />
                </TouchableOpacity>
            )}
            {!isOwnProfile && onReportPress && (
                <TouchableOpacity
                    onPress={onReportPress}
                    className="bg-red-500/20 p-2.5 rounded-xl border border-red-500/20"
                >
                    <AlertTriangle size={20} color="white" />
                </TouchableOpacity>
            )}
            {onSharePress && (
                <TouchableOpacity
                    onPress={onSharePress}
                    className="bg-white/10 p-2.5 rounded-xl border border-white/20"
                >
                    <Share2 size={20} color="white" />
                </TouchableOpacity>
            )}
            {isOwnProfile && (
                <TouchableOpacity
                    onPress={onSettingsPress}
                    className="bg-white/10 p-2.5 rounded-xl border border-white/20"
                >
                    <Settings size={20} color="white" />
                </TouchableOpacity>
            )}
        </View>
    );

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
                {/* Account Deletion Warning */}
                {isOwnProfile && <AccountDeletionAlert />}

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
                    levelName={gamificationState.levelName}
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
                    affiliatedNPOs={affiliatedNPOs as any}
                    followedNPOs={followedNPOs as any}
                />

                {children}
            </ScrollView>
        </StandardLayout >
    );
};
