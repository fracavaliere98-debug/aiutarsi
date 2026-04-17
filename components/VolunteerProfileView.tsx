import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Modal, Text } from "react-native";
import { Settings, MessageCircle, AlertTriangle, Share2, MoreVertical } from "lucide-react-native";
import { StandardLayout } from "./StandardLayout";
import { AppUser, OldApplication } from "../types";
import { Layout } from "../utils/layout";

import { ProfileHeader } from "./profile/ProfileHeader";
import { ProfileStats } from "./profile/ProfileStats";
import { BadgeSection } from "./profile/BadgeSection";
import { ApplicationSection } from "./profile/ApplicationSection";
import { NPOAffiliationSection } from "./profile/NPOAffiliationSection";
import { SkillInterestSection } from "./profile/SkillInterestSection";
import { AccountDeletionAlert } from "./AccountDeletionAlert";
import { GamificationState as CanonicalGamificationState } from "../hooks/gamification/types";

interface VolunteerStats {
    totalHours: number;
    completedMissions: number;
    rating: number;
}

interface VolunteerProfileViewProps {
    user: AppUser | null;
    gamificationState: CanonicalGamificationState;
    levelName?: string;
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
    approvedNPOApplications?: OldApplication[];
    hideBack?: boolean;
    children?: React.ReactNode;
}

export function VolunteerProfileView({
    user,
    gamificationState,
    levelName,
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
    approvedNPOApplications = [],
    hideBack = false,
    children
}: VolunteerProfileViewProps) {
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const iconSize = Layout.iconSize.md;

    const HeaderActions = (
        <View className="flex-row gap-2">
            {!isOwnProfile && onMessagePress && (
                <TouchableOpacity
                    onPress={onMessagePress}
                    className="bg-white/10 p-2.5 rounded-xl border border-white/20"
                >
                    <MessageCircle size={iconSize} color="white" />
                </TouchableOpacity>
            )}
            {onSharePress && (
                <TouchableOpacity
                    onPress={onSharePress}
                    className="bg-white/10 p-2.5 rounded-xl border border-white/20"
                >
                    <Share2 size={iconSize} color="white" />
                </TouchableOpacity>
            )}
            {!isOwnProfile && onReportPress && (
                <TouchableOpacity
                    onPress={() => setShowActionsMenu(true)}
                    className="px-1 py-2"
                >
                    <MoreVertical size={iconSize} color="white" />
                </TouchableOpacity>
            )}
            {isOwnProfile && (
                <TouchableOpacity
                    onPress={onSettingsPress}
                    className="bg-white/10 p-2.5 rounded-xl border border-white/20"
                >
                    <Settings size={iconSize} color="white" />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <>
            <StandardLayout
                label={isOwnProfile ? "Il tuo Profilo" : "Profilo Volontario"}
                title={isOwnProfile ? "Profilo" : (user?.name || "Volontario")}
                rightElement={HeaderActions}
                bg="bg-white"
                noPadding
                onBack={onBack}
                hideBack={hideBack}
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
                        levelName={levelName}
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
                    <BadgeSection badges={gamificationState.badges} gamificationState={gamificationState} />

                    {/* 5. NPO Applications (Own profile only) */}
                    {isOwnProfile && <ApplicationSection applications={npoApplications} />}

                    {/* 6. Affiliations & Following */}
                    <NPOAffiliationSection
                        isOwnProfile={isOwnProfile}
                        affiliatedNPOs={affiliatedNPOs as any}
                        followedNPOs={followedNPOs as any}
                        approvedApplications={approvedNPOApplications}
                    />

                    {children}
                </ScrollView>
            </StandardLayout>

            <Modal transparent visible={showActionsMenu} animationType="fade" onRequestClose={() => setShowActionsMenu(false)}>
                <TouchableOpacity className="flex-1 bg-black/20" activeOpacity={1} onPress={() => setShowActionsMenu(false)}>
                    <View className="absolute top-20 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 w-52 overflow-hidden">
                        <TouchableOpacity
                            className="flex-row items-center px-4 py-3 active:bg-red-50"
                            onPress={() => {
                                setShowActionsMenu(false);
                                onReportPress?.();
                            }}
                        >
                            <AlertTriangle size={20} color="#ef4444" />
                            <Text className="ml-3 text-red-500 font-medium">Segnala utente</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};
