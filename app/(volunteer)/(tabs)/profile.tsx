import { View } from "react-native";
import { useAuth } from "../../../context/AuthContext";
import { useActivities } from "../../../context/ActivityContext";
import { useApplications } from "../../../context/ApplicationContext";
import { useGamification } from "../../../context/GamificationContext";
import { useRouter } from "expo-router";
import { VolunteerProfileView } from "../../../components/VolunteerProfileView";

export default function VolunteerProfile() {
    const { user, users } = useAuth();
    const { volunteerStats, activityApplications, reviews } = useActivities();
    const { state, levelProgress, nextLevelXP, currentLevelXP } = useGamification();
    const router = useRouter();

    const xpInLevel = state.totalXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;

    // Get NPO lists
    const { getVolunteerApplications } = useApplications();
    const myApplications = getVolunteerApplications(user?.id || "");

    const affiliatedNPOIds = myApplications
        .filter(app => app.status === "APPROVED")
        .map(app => app.npoId);

    const affiliatedNPOs = users.filter(u => affiliatedNPOIds.includes(u.id));

    const followedNPOs = users.filter(u => user?.followedNPOs?.includes(u.id));

    // Calculate rating from real reviews
    const myReviews = reviews.filter(r => r.volunteerId === user?.id);
    const averageRating = myReviews.length > 0
        ? myReviews.reduce((sum, r) => sum + r.stars, 0) / myReviews.length
        : 0;

    const enrichedStats = {
        ...volunteerStats,
        rating: averageRating
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
            followedNPOs={followedNPOs}
            affiliatedNPOs={affiliatedNPOs}
            npoApplications={myApplications}
        />
    );
}
