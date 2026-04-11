import { Share } from "react-native";
import React from "react";
import { useAuth } from "../../../context/AuthContext";
import { useApplications } from "../../../context/ApplicationContext";
import { useGamification } from "../../../context/GamificationContext";
import { useRouter } from "expo-router";
import { VolunteerProfileView } from "../../../components/VolunteerProfileView";
import { AppUser } from "../../../types";
import { useActivityReviewsQuery } from "../../../hooks/activities/queries";
import { useVolunteerStats } from "../../../hooks/activities/selectors";

export default function VolunteerProfile() {
    const { user, users, fetchUserById } = useAuth();
    const volunteerStats = useVolunteerStats(user);
    const { data: reviews = [] } = useActivityReviewsQuery();
    const { state, levelProgress, nextLevelXP, currentLevelXP } = useGamification();
    const router = useRouter();
    const [affiliatedNPOs, setAffiliatedNPOs] = React.useState<AppUser[]>([]);
    const [followedNPOs, setFollowedNPOs] = React.useState<AppUser[]>([]);

    const xpInLevel = state.totalXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;

    // Get NPO lists
    const { getVolunteerApplications } = useApplications();
    const myApplications = getVolunteerApplications(user?.id || "");

    const pendingApplications = React.useMemo(
        () => myApplications.filter((app) => app.status === "PENDING"),
        [myApplications]
    );

    const approvedApplications = React.useMemo(
        () => myApplications.filter((app) => app.status === "APPROVED"),
        [myApplications]
    );

    const affiliatedNPOIds = React.useMemo(
        () => approvedApplications.map(app => app.npoId),
        [approvedApplications]
    );

    const followedNPOIds = React.useMemo(
        () => user?.followedNPOs || [],
        [user?.followedNPOs]
    );

    React.useEffect(() => {
        let isMounted = true;

        const loadNpoLists = async () => {
            if (!user?.id) {
                if (isMounted) {
                    setAffiliatedNPOs([]);
                    setFollowedNPOs([]);
                }
                return;
            }

            const uniqueAffiliatedIds = Array.from(new Set(affiliatedNPOIds.filter(Boolean)));
            const uniqueFollowedIds = Array.from(new Set(followedNPOIds.filter(Boolean)));

            const resolveProfiles = async (ids: string[]) => {
                const cached = ids
                    .map((id) => users.find((profile) => profile.id === id && profile.role === "NPO"))
                    .filter(Boolean) as AppUser[];

                const missingIds = ids.filter((id) => !cached.some((profile) => profile.id === id));
                const fetched = await Promise.all(missingIds.map((id) => fetchUserById(id)));

                return [...cached, ...fetched.filter((profile): profile is AppUser => !!profile && profile.role === "NPO")];
            };

            const [affiliated, followed] = await Promise.all([
                resolveProfiles(uniqueAffiliatedIds),
                resolveProfiles(uniqueFollowedIds),
            ]);

            if (isMounted) {
                setAffiliatedNPOs(affiliated);
                setFollowedNPOs(followed);
            }
        };

        void loadNpoLists();

        return () => {
            isMounted = false;
        };
    }, [affiliatedNPOIds, fetchUserById, followedNPOIds, user?.id, users]);

    // Calculate rating from real reviews
    const myReviews = reviews.filter(r => r.volunteerId === user?.id);
    const averageRating = myReviews.length > 0
        ? myReviews.reduce((sum, r) => sum + r.stars, 0) / myReviews.length
        : 0;

    const enrichedStats = {
        ...volunteerStats,
        rating: averageRating
    };

    const handleShare = async () => {
        if (!user) return;
        try {
            await Share.share({
                message: `👤 ${user.full_name || user.name || 'Volontario'}\nEcco il mio profilo su AiutarSì!\n\n📱 Apri direttamente nell'app:\naiutarsiapp://volunteer-profile/${user.id}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/volunteer-profile/${user.id}`,
            });
        } catch (error) {
            console.error("Error sharing profile:", error);
        }
    };

    return (
        <VolunteerProfileView
            user={user}
            gamificationState={state}
            stats={enrichedStats}
            levelProgress={levelProgress}
            xpInLevel={xpInLevel}
            xpNeededForLevel={xpNeededForLevel}
            isOwnProfile={true}
            onSettingsPress={() => router.push("/(volunteer)/settings" as any)}
            onSharePress={handleShare}
            followedNPOs={followedNPOs}
            affiliatedNPOs={affiliatedNPOs}
            npoApplications={pendingApplications}
            approvedNPOApplications={approvedApplications}
            hideBack={true}
        />
    );
}
