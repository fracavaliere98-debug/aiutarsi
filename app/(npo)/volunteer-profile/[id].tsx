import { View, Text, ActivityIndicator, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useActivities } from "../../../context/ActivityContext";
import { useApplications } from "../../../context/ApplicationContext";
import { getUserGamificationState, getXPForNextLevel, getXPForCurrentLevel } from "../../../context/GamificationContext";
import { VolunteerProfileView } from "../../../components/VolunteerProfileView";
import { OldUser } from "../../../types";
import ChatService from "../../../services/ChatService";
import ReportModal from "../../../components/ReportModal";

export default function NPOVolunteerProfile() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { getUserById, users, user: currentUser } = useAuth();
    const { getVolunteerApplications } = useApplications();
    const { activities, reviews } = useActivities();

    const [user, setUser] = useState<OldUser | null>(null);
    const [gamificationState, setGamificationState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (typeof id !== 'string') return;

            try {
                // 1. Get OldUser Data
                const userData = getUserById(id); // from AuthContext
                setUser(userData || null);

                // 2. Get Gamification Data
                const gamiData = await getUserGamificationState(id);
                setGamificationState(gamiData);
            } catch (e) {
                console.error("Error loading volunteer profile", e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id, getUserById]);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#4f46e5" />
            </View>
        );
    }

    if (!user || !gamificationState) {
        return (
            <View className="flex-1 items-center justify-center bg-white relative">
                <VolunteerProfileView
                    user={{ name: "Utente non trovato" } as any}
                    gamificationState={{ level: 0, totalXP: 0, badges: [] }}
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

    const currentLevelXP = getXPForCurrentLevel(gamificationState.level);
    const nextLevelXP = getXPForNextLevel(gamificationState.level);
    const xpInLevel = gamificationState.totalXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    const levelProgress = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));

    // Get NPO lists for this user
    const userApplications = getVolunteerApplications(user.id);

    const affiliatedNPOIds = userApplications
        .filter(app => app.status === "APPROVED")
        .map(app => app.npoId);

    const affiliatedNPOs = users.filter(u => affiliatedNPOIds.includes(u.id));

    // Check if user has followedNPOs
    const followedNPOs = users.filter(u => user.followedNPOs?.includes(u.id));

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
            router.push(`/messages/${convId}` as any);
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
