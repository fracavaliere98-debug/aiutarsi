import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { FlashList } from "@shopify/flash-list";

import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Search, Sparkles } from 'lucide-react-native';
import { useState, useMemo, useEffect } from "react";
import { StandardLayout } from "../../../components/StandardLayout";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";

import { VolunteerCard } from "../../../components/VolunteerCard";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { Colors } from "../../../constants/Colors";
import { useActivities } from "../../../context/ActivityContext";
import { useApplications } from "../../../context/ApplicationContext";
import { useNotifications } from "../../../context/NotificationContext";

type TabType = 'CANDIDATURE' | 'FOLLOWERS' | 'STORICO';

export default function VolunteersScreen() {
    const { user, getNPOFollowers, getUserById } = useAuth();
    const { getNPOApplications, approveApplication, rejectApplication } = useApplications();
    const {
        error,
        loadData,
        activityApplications,
        activities,
        approveActivityApplication,
        rejectActivityApplication
    } = useActivities();
    const { showToast } = useToast();
    const { addNotification } = useNotifications();
    const params = useLocalSearchParams();
    const router = useRouter();


    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        const t = params.tab as string;
        if (t === "FOLLOWERS" || t === "STORICO") return t as TabType;
        return "CANDIDATURE";
    });

    // Track when a volunteer was last invited { [volunteerId]: 'YYYY-MM-DD' }
    const [invitedVolunteers, setInvitedVolunteers] = useState<Record<string, string>>({});

    // Update tab if params change (e.g. navigation from dashboard)
    useEffect(() => {
        if (params.tab && ["CANDIDATURE", "FOLLOWERS", "STORICO"].includes(params.tab as string)) {
            setActiveTab(params.tab as TabType);
        }
    }, [params.tab]);

    const formattedActivityApps = useMemo(() => {
        // Only include applications for activities that belong to this NPO
        const myActivityIds = new Set(activities.map(a => a.id));

        return activityApplications
            .filter(app => myActivityIds.has(app.activityId))
            .map(app => {
                const act = activities.find(a => a.id === app.activityId);
                return {
                    id: app.id,
                    isActivity: true, // Marker for handlers
                    activityId: app.activityId,
                    embedding: user?.embedding ?? undefined,
                    npoId: user?.id || "",
                    npoName: act ? `Attività: ${act.title}` : "Attività",
                    volunteerId: app.volunteerId,
                    volunteerName: app.volunteerName,
                    volunteerAvatar: app.volunteerAvatar,
                    message: app.message || "",
                    skills: [],
                    status: app.status,
                    appliedDate: app.appliedDate
                };
            });
    }, [activityApplications, activities, user]);

    const allApplications = useMemo(() => {
        const npoApps = getNPOApplications(user?.id || "");
        return [...npoApps, ...formattedActivityApps];
    }, [getNPOApplications, user, formattedActivityApps]);

    // Sort by date descending (newest first)
    const pendingApplications = allApplications
        .filter(a => a.status === "PENDING")
        .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());

    const approvedVolunteers = allApplications
        .filter(a => a.status === "APPROVED")
        .sort((a, b) => {
            const dateA = (a as any).reviewedDate ? new Date((a as any).reviewedDate) : new Date(a.appliedDate);
            const dateB = (b as any).reviewedDate ? new Date((b as any).reviewedDate) : new Date(b.appliedDate);
            return dateB.getTime() - dateA.getTime();
        });

    const followers = getNPOFollowers(user?.id || "");

    // Smart Match Logic
    const matchedFollowers = useMemo(() => {
        if (!params.activityMatch) return [];
        const activity = activities.find(a => a.id === params.activityMatch);
        if (!activity) return [];

        return followers.map((f: any) => {
            const matchingSkills = f.skills.filter((s: string) => activity.skills.includes(s));
            return {
                ...f,
                matchScore: matchingSkills.length,
                matchingSkills
            };
        })
            .filter((f: any) => f.matchScore > 0)
            .sort((a: any, b: any) => b.matchScore - a.matchScore)
            .slice(0, 5);
    }, [followers, params.activityMatch, activities]);

    // Global filtering based on search query
    const searchFilter = (item: any) => {
        const query = searchQuery.toLowerCase();
        const vName = item.volunteerName || item.name || "";
        const vInterests = item.interests || [];
        return vName.toLowerCase().includes(query) ||
            vInterests.some((i: string) => i.toLowerCase().includes(query));
    };

    const handleApprove = async (applicationId: string) => {
        const app = allApplications.find(a => a.id === applicationId);
        if (!app) return;

        let success = false;
        if ((app as any).isActivity) {
            success = await approveActivityApplication((app as any).activityId, app.volunteerId);
        } else {
            success = await approveApplication(applicationId);
        }

        if (success) {
            showToast("success", "Candidatura approvata!");
        }
    };

    const handleReject = async (applicationId: string) => {
        const app = allApplications.find(a => a.id === applicationId);
        if (!app) return;

        let success = false;
        if ((app as any).isActivity) {
            success = await rejectActivityApplication((app as any).activityId, app.volunteerId);
        } else {
            success = await rejectApplication(applicationId);
        }

        if (success) {
            showToast("info", "Candidatura rifiutata");
        }
    };

    const displayPending = pendingApplications.filter(searchFilter);
    const displayApproved = approvedVolunteers.filter(searchFilter);
    const displayFollowers = followers.filter(searchFilter);

    const handleInviteFollower = (volunteerId: string) => {
        const today = new Date().toISOString().split('T')[0];

        if (invitedVolunteers[volunteerId] === today) {
            showToast("error", "Hai già invitato questo volontario oggi.");
            return;
        }

        // Simula invio invito
        addNotification({
            type: "ACTIVITY_UPDATE",
            title: "Invito Attività 🤝",
            message: `${user?.npoName || 'Una NPO'} ti invita a partecipare alle proprie attività aperte!`,
            userId: volunteerId
        });

        setInvitedVolunteers(prev => ({
            ...prev,
            [volunteerId]: today
        }));

        showToast("success", "Invito inviato con successo!");
    };

    // If no tabs available, show empty state (Optional: could also just show empty list under tabs)
    // but preserving "empty state if NOTHING at all" is okay.
    // However, the segmented control usually is always visible.
    // Let's keep it visible so user can switch and see empty states per tab.

    if (error) {
        return (
            <View className="flex-1 bg-white">
                <ErrorState
                    title="Errore applicazioni"
                    description="Impossibile caricare l'elenco dei volontari."
                    onRetry={loadData}
                />
            </View>
        );
    }

    const Tabs = () => (
        <View className="flex-row justify-center gap-3 mb-4">
            <TouchableOpacity
                onPress={() => setActiveTab("CANDIDATURE")}
                style={{
                    paddingHorizontal: 24,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: activeTab === "CANDIDATURE" ? '#382487' : '#f0f2f5',
                    shadowColor: activeTab === "CANDIDATURE" ? '#382487' : '#d1d9e6',
                    shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: activeTab === "CANDIDATURE" ? 0.3 : 1,
                    shadowRadius: activeTab === "CANDIDATURE" ? 8 : 8,
                    elevation: activeTab === "CANDIDATURE" ? 4 : 2,
                    borderWidth: activeTab === "CANDIDATURE" ? 0 : 1,
                    borderColor: 'rgba(255,255,255,0.4)',
                }}
            >
                <Text style={{
                    color: activeTab === "CANDIDATURE" ? 'white' : '#475569',
                    fontSize: 14,
                    fontWeight: '600'
                }}>
                    In attesa
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setActiveTab("STORICO")}
                style={{
                    paddingHorizontal: 24,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: activeTab === "STORICO" ? '#382487' : '#f0f2f5',
                    shadowColor: activeTab === "STORICO" ? '#382487' : '#d1d9e6',
                    shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: activeTab === "STORICO" ? 0.3 : 1,
                    shadowRadius: activeTab === "STORICO" ? 8 : 8,
                    elevation: activeTab === "STORICO" ? 4 : 2,
                    borderWidth: activeTab === "STORICO" ? 0 : 1,
                    borderColor: 'rgba(255,255,255,0.4)',
                }}
            >
                <Text style={{
                    color: activeTab === "STORICO" ? 'white' : '#475569',
                    fontSize: 14,
                    fontWeight: '600'
                }}>
                    Volontari
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setActiveTab("FOLLOWERS")}
                style={{
                    paddingHorizontal: 24,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: activeTab === "FOLLOWERS" ? '#382487' : '#f0f2f5',
                    shadowColor: activeTab === "FOLLOWERS" ? '#382487' : '#d1d9e6',
                    shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: activeTab === "FOLLOWERS" ? 0.3 : 1,
                    shadowRadius: activeTab === "FOLLOWERS" ? 8 : 8,
                    elevation: activeTab === "FOLLOWERS" ? 4 : 2,
                    borderWidth: activeTab === "FOLLOWERS" ? 0 : 1,
                    borderColor: 'rgba(255,255,255,0.4)',
                }}
            >
                <Text style={{
                    color: activeTab === "FOLLOWERS" ? 'white' : '#475569',
                    fontSize: 14,
                    fontWeight: '600'
                }}>
                    Follower
                </Text>
            </TouchableOpacity>
        </View>
    );

    const HeaderActions = <NPOHeaderActions />;

    return (
        <StandardLayout
            label="ATTIVITÀ"
            title="Volontari"
            rightElement={HeaderActions}
            noScroll={true}
            bg="bg-[#f0f2f5]"
            hideBack={true}
        >
            <View className="px-0 pb-1">
                {/* Soft UI Inset Search Bar */}
                <View className="px-0 mb-4">
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#f0f2f5',
                            paddingHorizontal: 16,
                            paddingVertical: 4,
                            borderRadius: 999, // Pill style to match tabs
                            borderWidth: 1,
                            borderColor: 'rgba(0,0,0,0.08)',
                            shadowColor: '#d1d9e6',
                            shadowOffset: { width: 4, height: 4 },
                            shadowOpacity: 0.8,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <Search size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="Cerca volontari..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={{
                                fontSize: 13,
                                height: 40,
                                flex: 1,
                                marginLeft: 10,
                                color: '#1e293b',
                                fontWeight: '600'
                            }}
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                </View>

                <Tabs />
            </View>

            {/* CANDIDATURE Tab */}
            {activeTab === "CANDIDATURE" && (
                <View className="flex-1">
                    <View className="mb-3 px-1">
                        <Text className="text-primary font-black text-lg">Nuove OldCandidature</Text>
                    </View>

                    {displayPending.length > 0 ? (
                        <FlashList
                            data={displayPending as any[]}
                            keyExtractor={item => item.id}
                            // @ts-ignore
                            estimatedItemSize={100}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => {
                                const fullVolunteer = getUserById(item.volunteerId);
                                const enrichedVolunteer = (fullVolunteer || {
                                    id: item.volunteerId,
                                    name: item.volunteerName,
                                    avatar: item.volunteerAvatar,
                                    interests: [],
                                    email: '',
                                    role: 'VOLUNTEER' as const,
                                    impactPoints: 0,
                                    skills: [],
                                    profile_completed: true,
                                    deletionRequestedAt: null
                                }) as any;
                                return (
                                    <VolunteerCard
                                        volunteer={enrichedVolunteer}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${item.volunteerId}`)}
                                        actions={
                                            <View className="flex-row gap-2">
                                                <TouchableOpacity
                                                    onPress={() => handleReject(item.id)}
                                                    className="px-4 py-2 rounded-lg bg-gray-100"
                                                >
                                                    <Text className="text-gray-600 font-bold text-xs">Rifiuta</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleApprove(item.id)}
                                                    className="px-4 py-2 rounded-lg bg-primary"
                                                >
                                                    <Text className="text-white font-bold text-xs">Approva</Text>
                                                </TouchableOpacity>
                                            </View>
                                        }
                                    />
                                );
                            }}
                        />
                    ) : (
                        <EmptyState
                            emoji="✅"
                            title="Tutto in ordine"
                            description={searchQuery ? "Nessuna candidatura corrispondente" : "Non ci sono nuove candidature in attesa di revisione."}
                        />
                    )}
                </View>
            )}

            {/* FOLLOWERS Tab */}
            {activeTab === "FOLLOWERS" && (
                <View className="flex-1">
                    <View className="mb-2 px-1">
                        <Text className="text-primary font-black text-lg">I Tuoi Follower</Text>
                    </View>

                    {matchedFollowers.length > 0 && (
                        <View className="mb-6 px-1">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Sparkles size={18} color={Colors.accent} />
                                <Text className="text-secondary font-black text-xs uppercase tracking-widest">Top matches per l&apos;attività</Text>
                            </View>
                            {matchedFollowers.map((f) => (
                                <View key={`match-${f.id}`} className="mb-4">
                                    <VolunteerCard
                                        volunteer={f}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${f.id}`)}
                                        actions={
                                            <TouchableOpacity
                                                onPress={() => handleInviteFollower(f.id)}
                                                className="px-4 py-2 rounded-lg bg-accent"
                                            >
                                                <Text className="text-white font-bold text-xs">Invita Ora</Text>
                                            </TouchableOpacity>
                                        }
                                    />
                                </View>
                            ))}
                            <View className="h-[1px] bg-black/5 w-full my-4" />
                            <Text className="text-primary font-black text-lg mb-2">Tutti i Follower</Text>
                        </View>
                    )}

                    {displayFollowers.length > 0 ? (
                        <FlashList
                            data={displayFollowers.filter((f: any) => !matchedFollowers.find((m: any) => m.id === f.id)) as any[]}
                            // @ts-ignore
                            estimatedItemSize={100}
                            renderItem={({ item }) => (
                                <VolunteerCard
                                    volunteer={item}
                                    onPress={() => router.push(`/(npo)/volunteer-profile/${item.id}`)}
                                />
                            )}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    ) : (
                        <EmptyState
                            emoji="👥"
                            title="Nessun Follower"
                            description={searchQuery ? "Nessun risultato per la ricerca" : "Quando i volontari seguiranno la tua NPO, appariranno qui"}
                        />
                    )}
                </View>
            )}

            {/* STORICO Tab - Approved Volunteers (Now "Volontari") */}
            {activeTab === "STORICO" && (
                <View className="flex-1">
                    <View className="mb-2">
                        <Text className="text-primary font-black text-lg">I Tuoi Volontari</Text>
                    </View>

                    {displayApproved.length > 0 ? (
                        <FlashList
                            data={displayApproved as any[]}
                            keyExtractor={item => item.id}
                            // @ts-ignore
                            estimatedItemSize={100}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => {
                                const fullVolunteer = getUserById(item.volunteerId);
                                const enrichedVolunteer = (fullVolunteer || {
                                    id: item.volunteerId,
                                    name: item.volunteerName,
                                    avatar: item.volunteerAvatar,
                                    interests: [],
                                    email: '',
                                    role: 'VOLUNTEER' as const,
                                    impactPoints: 0,
                                    skills: [],
                                    profile_completed: true,
                                    deletionRequestedAt: null
                                }) as any;
                                return (
                                    <VolunteerCard
                                        volunteer={enrichedVolunteer}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${item.volunteerId}`)}
                                        actions={
                                            <TouchableOpacity
                                                onPress={() => handleInviteFollower(enrichedVolunteer.id)}
                                                className="px-4 py-2 rounded-lg bg-primary"
                                            >
                                                <Text className="text-white font-bold text-xs">Invita ad attività</Text>
                                            </TouchableOpacity>
                                        }
                                    />
                                );
                            }}
                        />
                    ) : (
                        <EmptyState
                            emoji="users"
                            title="Nessun Volontario"
                            description={searchQuery ? "Nessun volontario corrispondente" : "I volontari approvati appariranno qui."}
                        />
                    )}
                </View>
            )}
        </StandardLayout>
    );
}
