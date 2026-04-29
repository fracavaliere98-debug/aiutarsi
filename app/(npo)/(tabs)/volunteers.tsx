import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { FlashList } from "@shopify/flash-list";

import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Search, Sparkles, Clock3, UsersRound, HeartHandshake } from 'lucide-react-native';
import { useState, useMemo, useEffect } from "react";
import { StandardLayout } from "../../../components/StandardLayout";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";

import { VolunteerCard } from "../../../components/VolunteerCard";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { Colors } from "../../../constants/Colors";
import { useNotificationsDomain } from "../../../hooks/notifications/useNotificationsDomain";
import { useActivitiesListQuery, useActivityApplicationsQuery } from "../../../hooks/activities/queries";
import { useApproveActivityApplicationMutation, useRejectActivityApplicationMutation } from "../../../hooks/activities/mutations";
import { useApproveApplicationMutation, useRejectApplicationMutation } from "../../../hooks/applications/mutations";
import { useNPOApplications } from "../../../hooks/applications/selectors";

type TabType = 'CANDIDATURE' | 'FOLLOWERS' | 'STORICO';

const TabCountBadge = ({ count, active }: { count: number; active: boolean }) => (
    <View
        style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 6,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            backgroundColor: active ? "rgba(255,255,255,0.18)" : "rgba(56,36,135,0.1)",
        }}
    >
        <Text
            style={{
                color: active ? "white" : "#382487",
                fontSize: 11,
                lineHeight: 20,
                fontWeight: "900",
                includeFontPadding: false,
                textAlignVertical: "center",
            }}
        >
            {count}
        </Text>
    </View>
);

const TabIconSlot = ({ children }: { children: React.ReactNode }) => (
    <View style={{ width: 16, height: 20, alignItems: "center", justifyContent: "center" }}>
        {children}
    </View>
);

const tabLabelTextStyle = (active: boolean) => ({
    color: active ? "white" : "#475569",
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "600" as const,
    includeFontPadding: false,
    textAlignVertical: "center" as const,
});

export default function VolunteersScreen() {
    const { user, getNPOFollowers, getUserById } = useAuth();
    const npoApplications = useNPOApplications(user, user?.id);
    const approveApplicationMutation = useApproveApplicationMutation(user);
    const rejectApplicationMutation = useRejectApplicationMutation(user);
    const { showToast } = useToast();
    const { addNotification } = useNotificationsDomain();
    const params = useLocalSearchParams();
    const router = useRouter();
    const { data: activities = [], isError: activitiesError, refetch: refetchActivities } = useActivitiesListQuery(user?.id);
    const { data: activityApplications = [], refetch: refetchActivityApplications } = useActivityApplicationsQuery(user?.id, !!user && user.role === "NPO");
    const approveActivityApplicationMutation = useApproveActivityApplicationMutation();
    const rejectActivityApplicationMutation = useRejectActivityApplicationMutation();


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
        return [...npoApplications, ...formattedActivityApps];
    }, [npoApplications, formattedActivityApps]);

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
            await approveActivityApplicationMutation.mutateAsync({ activityId: (app as any).activityId, volunteerId: app.volunteerId });
            success = true;
        } else {
            success = await approveApplicationMutation.mutateAsync(app as any);
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
            await rejectActivityApplicationMutation.mutateAsync({ activityId: (app as any).activityId, volunteerId: app.volunteerId });
            success = true;
        } else {
            success = await rejectApplicationMutation.mutateAsync(app as any);
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

    if (activitiesError) {
        return (
            <View className="flex-1 bg-white">
                <ErrorState
                    title="Errore applicazioni"
                    description="Impossibile caricare l'elenco dei volontari."
                    onRetry={() => Promise.all([refetchActivities(), refetchActivityApplications()]).then(() => undefined)}
                />
            </View>
        );
    }

    const Tabs = () => (
        <View className="flex-row justify-center gap-3 mb-4">
            <TouchableOpacity
                onPress={() => setActiveTab("CANDIDATURE")}
                style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    paddingHorizontal: 8,
                    paddingVertical: 0,
                    borderRadius: 999,
                    justifyContent: "center",
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
                <View style={{ height: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <TabIconSlot>
                        <Clock3 size={13} color={activeTab === "CANDIDATURE" ? 'white' : '#475569'} />
                    </TabIconSlot>
                    <Text style={tabLabelTextStyle(activeTab === "CANDIDATURE")}>
                        In attesa
                    </Text>
                    <TabCountBadge count={pendingApplications.length} active={activeTab === "CANDIDATURE"} />
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setActiveTab("STORICO")}
                style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    paddingHorizontal: 8,
                    paddingVertical: 0,
                    borderRadius: 999,
                    justifyContent: "center",
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
                <View style={{ height: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <TabIconSlot>
                        <UsersRound size={13} color={activeTab === "STORICO" ? 'white' : '#475569'} />
                    </TabIconSlot>
                    <Text style={tabLabelTextStyle(activeTab === "STORICO")}>
                        Volontari
                    </Text>
                    <TabCountBadge count={approvedVolunteers.length} active={activeTab === "STORICO"} />
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setActiveTab("FOLLOWERS")}
                style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    paddingHorizontal: 8,
                    paddingVertical: 0,
                    borderRadius: 999,
                    justifyContent: "center",
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
                <View style={{ height: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <TabIconSlot>
                        <HeartHandshake size={13} color={activeTab === "FOLLOWERS" ? 'white' : '#475569'} />
                    </TabIconSlot>
                    <Text style={tabLabelTextStyle(activeTab === "FOLLOWERS")}>
                        Follower
                    </Text>
                    <TabCountBadge count={followers.length} active={activeTab === "FOLLOWERS"} />
                </View>
            </TouchableOpacity>
        </View>
    );

    const HeaderActions = <NPOHeaderActions />;
    const npoDisplayName = user?.npoName || user?.name || "il tuo ente";

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
                        <Text className="text-primary font-black text-lg">Nuove candidature</Text>
                        <Text className="text-secondary text-xs font-semibold mt-1">
                            Approva rapidamente chi può entrare nel tuo ente come volontario.
                        </Text>
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
                                    impact_points: 0,
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
                        <Text className="text-secondary text-xs font-semibold mt-1">
                            Persone che seguono la tua NPO e che puoi coinvolgere nelle prossime attività.
                        </Text>
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
                        <Text className="text-secondary text-xs font-semibold mt-1">
                            Volontari già approvati che fan parte di {npoDisplayName}.
                        </Text>
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
                                    impact_points: 0,
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
