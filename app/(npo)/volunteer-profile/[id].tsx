import { View, ActivityIndicator, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { VolunteerProfileView } from "../../../components/VolunteerProfileView";
import { AppUser } from "../../../types";
import ChatService from "../../../services/ChatService";
import ReportModal from "../../../components/ReportModal";
import { useActivitiesDomain } from "../../../hooks/activities/selectors";
import { useVolunteerApplications } from "../../../hooks/applications/selectors";
import { useGamificationView } from "../../../hooks/gamification/selectors";

export default function NPOVolunteerProfile() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { fetchUserById, user: currentUser } = useAuth();
    const { activities, reviews } = useActivitiesDomain(undefined);

    const [user, setUser] = useState<AppUser | null>(null);
    const [affiliatedNPOs, setAffiliatedNPOs] = useState<AppUser[]>([]);
    const [followedNPOs, setFollowedNPOs] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const { state: gamificationState, levelProgress, xpInLevel, xpNeededForLevel, levelName } = useGamificationView(user);

    useEffect(() => {
        const loadData = async () => {
            if (typeof id !== 'string') return;

            try {
                const userData = await fetchUserById(id);
                setUser(userData || null);
            } catch (e) {
                console.error("Error loading volunteer profile", e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id, fetchUserById]);

    const userApplications = useVolunteerApplications(currentUser, user?.id);
    const affiliatedNPOIds = useMemo(
        () => userApplications.filter(app => app.status === "APPROVED").map(app => app.npoId),
        [userApplications]
    );
    const followedNPOIds = useMemo(() => user?.followedNPOs || [], [user?.followedNPOs]);

    useEffect(() => {
        if (!user) {
            setAffiliatedNPOs([]);
            setFollowedNPOs([]);
            return;
        }

        let isActive = true;

        const loadRelatedNPOs = async () => {
            const uniqueAffiliatedIds = Array.from(new Set(affiliatedNPOIds));
            const uniqueFollowedIds = Array.from(new Set(followedNPOIds));

            const [affiliatedProfiles, followedProfiles] = await Promise.all([
                Promise.all(uniqueAffiliatedIds.map(npoId => fetchUserById(npoId))),
                Promise.all(uniqueFollowedIds.map(npoId => fetchUserById(npoId))),
            ]);

            if (!isActive) return;

            setAffiliatedNPOs(affiliatedProfiles.filter((profile): profile is AppUser => Boolean(profile)));
            setFollowedNPOs(followedProfiles.filter((profile): profile is AppUser => Boolean(profile)));
        };

        void loadRelatedNPOs();

        return () => {
            isActive = false;
        };
    }, [user, affiliatedNPOIds, followedNPOIds, fetchUserById]);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#4f46e5" />
            </View>
        );
    }

    if (!user) {
        return (
            <View className="flex-1 items-center justify-center bg-white relative">
                <VolunteerProfileView
                    user={{ name: "Utente non trovato" } as any}
                    gamificationState={{
                        level: 0,
                        totalXP: 0,
                        badges: [],
                        completedActivitiesCount: 0,
                        processedActivityIds: [],
                        sharedActivities: [],
                        enrolledNPOs: [],
                        claimedMilestones: [],
                        followedNPOsHistory: [],
                        totalHours: 0,
                        completedCategories: [],
                        completionDates: [],
                        reviewedNpoIds: [],
                    }}
                    levelName="Novizio"
                    stats={{ totalHours: 0, completedMissions: 0, rating: 0 }}
                    levelProgress={0}
                    xpInLevel={0}
                    xpNeededForLevel={100}
                    onBack={() => router.back()}
                    affiliatedNPOs={[]}
                    npoApplications={[]}
                />
            </View>
        );
    }

    // 3. Calculate Real Stats for this volunteer
    const volunteerStats = {
        totalHours: 0,
        completedMissions: 0,
        activeMissions: 0,
        upcomingMissions: 0,
        totalXP: gamificationState.totalXP || 0
    } as any;

    if (user && activities.length > 0) {
        const myActivities = activities.filter(a => a.iscritti.includes(user.id));
        const completed = myActivities.filter(a => a.status === 'COMPLETATA');
        const active = myActivities.filter(a => a.status === 'IN_CORSO');
        const upcoming = myActivities.filter(a => a.status === 'APERTA');

        const hours = completed.reduce((acc, curr) => {
            const start = new Date(curr.dateTime).getTime();
            const end = new Date(curr.endDateTime).getTime();
            const durationMs = end - start;
            const durationHours = durationMs / (1000 * 60 * 60);
            return acc + (isNaN(durationHours) ? 0 : durationHours);
        }, 0);

        volunteerStats.totalHours = Math.round(hours);
        volunteerStats.completedMissions = completed.length;
        volunteerStats.activeMissions = active.length;
        volunteerStats.upcomingMissions = upcoming.length;
    }

    // Calculate rating from real reviews
    const myReviews = reviews.filter(r => r.volunteerId === user?.id);
    const averageRating = myReviews.length > 0
        ? myReviews.reduce((sum, r) => sum + r.stars, 0) / myReviews.length
        : 0;

    const enrichedStats = {
        ...volunteerStats,
        rating: averageRating
    };

    const handleMessageVolunteer = async () => {
        if (!user) return;
        try {
            const convId = await ChatService.startPrivateConversation(currentUser?.id || '', user.id);
            router.push({
                pathname: `/messages/${convId}` as any,
                params: {
                    targetUserId: user.id,
                    targetName: user.name || 'Volontario',
                    targetRole: 'VOLUNTEER',
                    targetAvatar: user.avatar || '',
                }
            } as any);
        } catch (error) {
            console.error("Error starting chat with volunteer:", error);
        }
    };

    const handleShare = async () => {
        if (!user) return;
        try {
            await Share.share({
                message: `👤 ${user.name || 'Volontario'}\nScopri questo Volontario su AiutarSì!\n\n📱 Apri direttamente nell'app:\naiutarsiapp://volunteer-profile/${id}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/volunteer-profile/${id}`,
            });
        } catch (error) {
            console.error("Error sharing volunteer profile:", error);
        }
    };

    return (
        <>
            <VolunteerProfileView
                user={user as any}
                gamificationState={gamificationState}
                levelName={levelName}
                stats={enrichedStats}
                levelProgress={levelProgress}
                xpInLevel={xpInLevel}
                xpNeededForLevel={xpNeededForLevel}
                onBack={() => router.back()}
                onMessagePress={handleMessageVolunteer}
                onReportPress={() => setShowReportModal(true)}
                onSharePress={handleShare}
                followedNPOs={followedNPOs as any[]}
                affiliatedNPOs={affiliatedNPOs as any[]}
                npoApplications={userApplications}
            />

            {/* Modal di Segnalazione */}
            <ReportModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                reportedUser={user as any}
                contentType="profile"
            />
        </>
    );
}
