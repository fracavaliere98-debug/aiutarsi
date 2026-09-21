import { View, Text, TextInput } from "react-native";
import { FlashList } from "@shopify/flash-list";

import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Search, Sparkles, Clock3, UsersRound, HeartHandshake } from 'lucide-react-native';
import { useState, useMemo, useEffect } from "react";
import { StandardLayout } from "../../../components/StandardLayout";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";

import { CandidacyCard } from "../../../components/npo/CandidacyCard";
import { VolunteerRelationCard } from "../../../components/npo/VolunteerRelationCard";
import { InviteToActivityModal } from "../../../components/npo/InviteToActivityModal";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { SectionHeader, SegmentedControl, type SegmentedControlItem } from "../../../components/ui";
import { useActivitiesListQuery, useActivityApplicationsQuery } from "../../../hooks/activities/queries";
import { useSendNpoInviteMutation } from "../../../hooks/npo/mutations";
import { useApproveActivityApplicationMutation, useRejectActivityApplicationMutation } from "../../../hooks/activities/mutations";
import { useApproveApplicationMutation, useRejectApplicationMutation } from "../../../hooks/applications/mutations";
import { useStartPrivateConversationMutation } from "../../../hooks/chat/mutations";
import { useNPOFollowersQuery } from "../../../hooks/npo/queries";
import { useNPOApplications } from "../../../hooks/applications/selectors";
import { colors, palette } from "../../../theme";

type TabType = 'CANDIDATURE' | 'FOLLOWERS' | 'STORICO';

export default function VolunteersScreen() {
    const { user, getUserById } = useAuth();
    const npoApplications = useNPOApplications(user, user?.id);
    const approveApplicationMutation = useApproveApplicationMutation(user);
    const rejectApplicationMutation = useRejectApplicationMutation(user);
    const { showToast } = useToast();
    const sendInviteMutation = useSendNpoInviteMutation();
    const params = useLocalSearchParams();
    const router = useRouter();
    const { data: activities = [], isError: activitiesError, refetch: refetchActivities } = useActivitiesListQuery(user?.id);
    const { data: activityApplications = [], refetch: refetchActivityApplications } = useActivityApplicationsQuery(user?.id, !!user && user.role === "NPO");
    const approveActivityApplicationMutation = useApproveActivityApplicationMutation();
    const rejectActivityApplicationMutation = useRejectActivityApplicationMutation();
    const startPrivateConversationMutation = useStartPrivateConversationMutation(user?.id);


    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        const t = params.tab as string;
        if (t === "FOLLOWERS" || t === "STORICO") return t as TabType;
        return "CANDIDATURE";
    });

    // Track when a volunteer was last invited { [chiave]: 'YYYY-MM-DD' }. Chiave per coppia
    // volontario+attività (non solo volontario): un invito mirato a un'attività urgente non
    // deve essere bloccato da un invito generico (o viceversa) mandato allo stesso volontario
    // in precedenza nella stessa giornata — sono intenti diversi, non vanno nello stesso bucket.
    const [invitedVolunteers, setInvitedVolunteers] = useState<Record<string, string>>({});
    const inviteKey = (volunteerId: string, activityId?: string) => `${volunteerId}:${activityId || 'generic'}`;

    // Target del modal "Invita ad attività" (generico vs attività specifica), aperto dal
    // tab Volontari (STORICO). null = modal chiuso.
    const [inviteActivityTarget, setInviteActivityTarget] = useState<{ id: string; name: string } | null>(null);

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

    const { data: followers = [] } = useNPOFollowersQuery(user?.id);

    // Attività dietro l'insight "Salvataggio Last Minute" (hooks/useNPOInsights.ts), se la
    // schermata è stata aperta da lì con ?activityMatch=<id>. Esposta separatamente (non solo
    // dentro matchedFollowers) perché serve anche per mandare un invito MIRATO a quell'attività,
    // non generico — è l'intero scopo per cui l'NPO è arrivata su questa schermata.
    const smartMatchActivity = useMemo(() => {
        if (!params.activityMatch) return null;
        return activities.find(a => a.id === params.activityMatch) || null;
    }, [activities, params.activityMatch]);

    // Smart Match Logic
    const matchedFollowers = useMemo(() => {
        if (!smartMatchActivity) return [];

        return followers.map((f: any) => {
            const matchingSkills = f.skills.filter((s: string) => smartMatchActivity.skills.includes(s));
            return {
                ...f,
                matchScore: matchingSkills.length,
                matchingSkills
            };
        })
            .filter((f: any) => f.matchScore > 0)
            .sort((a: any, b: any) => b.matchScore - a.matchScore)
            .slice(0, 5);
    }, [followers, smartMatchActivity]);

    // Prossime attività aperte di questa NPO, offerte come scelta nel modal "Invita ad
    // attività" (stesso concetto di "Prossime Attività" mostrato in app/npo-profile/[id].tsx).
    const upcomingOpenActivities = useMemo(() => {
        return activities
            .filter(a => a.status === "APERTA")
            .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    }, [activities]);

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

    const handleMessageVolunteer = async (volunteerId: string, volunteerName: string, volunteerAvatar?: string) => {
        try {
            const convId = await startPrivateConversationMutation.mutateAsync(volunteerId);
            router.push({
                pathname: `/messages/${convId}` as any,
                params: {
                    targetUserId: volunteerId,
                    targetName: volunteerName || 'Volontario',
                    targetRole: 'VOLUNTEER',
                    targetAvatar: volunteerAvatar || '',
                }
            } as any);
        } catch (error) {
            console.error("Error starting chat with volunteer:", error);
        }
    };

    const displayPending = pendingApplications.filter(searchFilter);
    const displayApproved = approvedVolunteers.filter(searchFilter);
    const displayFollowers = followers.filter(searchFilter);
    const tabItems = useMemo<SegmentedControlItem<TabType>[]>(() => ([
        {
            value: "CANDIDATURE",
            label: "In attesa",
            count: pendingApplications.length,
            icon: ({ color }) => <Clock3 size={13} color={color} />,
            testID: "npo-volunteers-tab-pending",
        },
        {
            value: "STORICO",
            label: "Volontari",
            count: approvedVolunteers.length,
            icon: ({ color }) => <UsersRound size={13} color={color} />,
            testID: "npo-volunteers-tab-approved",
        },
        {
            value: "FOLLOWERS",
            label: "Follower",
            count: followers.length,
            icon: ({ color }) => <HeartHandshake size={13} color={color} />,
            testID: "npo-volunteers-tab-followers",
        },
    ]), [approvedVolunteers.length, followers.length, pendingApplications.length]);

    // Invii NPO → volontario: passano dalla RPC server-side send_npo_invite (titolo/testo e
    // destinatario validati dal DB; dedup 24h e blocchi applicati lato server). Il guard
    // locale sotto serve solo a evitare una chiamata inutile nella stessa sessione.
    const sendInvite = async (
        kind: "OPEN_ACTIVITIES" | "APPLY" | "ACTIVITY",
        volunteerId: string,
        options: { activityId?: string; alreadySentMessage: string }
    ) => {
        const today = new Date().toISOString().split('T')[0];
        const key = inviteKey(volunteerId, options.activityId);

        if (invitedVolunteers[key] === today) {
            showToast("error", options.alreadySentMessage);
            return;
        }

        try {
            const sent = await sendInviteMutation.mutateAsync({ volunteerId, kind, activityId: options.activityId });
            if (!sent) {
                showToast("error", options.alreadySentMessage);
                return;
            }
            setInvitedVolunteers(prev => ({ ...prev, [key]: today }));
            showToast("success", "Invito inviato con successo!");
        } catch (error) {
            console.error("Error sending invite:", error);
            showToast("error", "Non è stato possibile inviare l'invito. Riprova.");
        }
    };

    // Invito generico "attività aperte": porta sul profilo dell'ente (npoId, senza activityId).
    const handleInviteFollower = (volunteerId: string) =>
        sendInvite("OPEN_ACTIVITIES", volunteerId, { alreadySentMessage: "Hai già invitato questo volontario oggi." });

    const handleInviteToVolunteer = (volunteerId: string) =>
        sendInvite("APPLY", volunteerId, { alreadySentMessage: "Hai già invitato questo volontario oggi." });

    // Invito mirato a una singola attività (modal "Invita ad attività", oppure dal match
    // "Invita a questa attività" nel tab Follower): la notifica apre direttamente quella scheda.
    const handleInviteToActivity = (volunteerId: string, activityId: string, _activityTitle: string) =>
        sendInvite("ACTIVITY", volunteerId, {
            activityId,
            alreadySentMessage: "Hai già invitato questo volontario oggi per questa attività.",
        });

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

    const HeaderActions = <NPOHeaderActions />;
    const npoDisplayName = user?.npoName || user?.name || "il tuo ente";

    return (
        <StandardLayout
            label="Volontari"
            title={npoDisplayName}
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
                            backgroundColor: colors.controlSurface,
                            paddingHorizontal: 16,
                            paddingVertical: 4,
                            borderRadius: 999, // Pill style to match tabs
                            borderWidth: 1,
                            borderColor: 'rgba(0,0,0,0.08)',
                            shadowColor: colors.controlShadow,
                            shadowOffset: { width: 4, height: 4 },
                            shadowOpacity: 0.8,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <Search size={16} color={palette.slate400} />
                        <TextInput
                            placeholder="Cerca volontari..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={{
                                fontSize: 13,
                                height: 40,
                                flex: 1,
                                marginLeft: 10,
                                color: palette.slate800,
                                fontWeight: '600'
                            }}
                            placeholderTextColor={palette.slate400}
                        />
                    </View>
                </View>

                <SegmentedControl items={tabItems} value={activeTab} onChange={setActiveTab} />
            </View>

            {/* CANDIDATURE Tab */}
            {activeTab === "CANDIDATURE" && (
                <View className="flex-1">
                    <SectionHeader
                        title="Nuove candidature"
                        description="Approva rapidamente chi può entrare nel tuo ente come volontario."
                        style={{ paddingHorizontal: 4 }}
                    />

                    {displayPending.length > 0 ? (
                        <FlashList
                            data={displayPending as any[]}
                            keyExtractor={item => item.id}
                            // @ts-ignore
                            estimatedItemSize={230}
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
                                    <CandidacyCard
                                        volunteer={enrichedVolunteer}
                                        appliedDate={(item as any).appliedDate}
                                        applicationMessage={(item as any).message}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${item.volunteerId}`)}
                                        onMessage={() => handleMessageVolunteer(item.volunteerId, enrichedVolunteer.name, enrichedVolunteer.avatar)}
                                        onReject={() => handleReject(item.id)}
                                        onApprove={() => handleApprove(item.id)}
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
                    <SectionHeader
                        title="I Tuoi Follower"
                        description="Persone che seguono la tua NPO e che puoi coinvolgere nelle prossime attività."
                        style={{ paddingHorizontal: 4, marginBottom: 8 }}
                    />

                    {matchedFollowers.length > 0 && (
                        <View className="mb-6 px-1">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Sparkles size={18} color={colors.accent} />
                                <Text className="text-secondary font-black text-xs uppercase tracking-widest">Top matches per l&apos;attività</Text>
                            </View>
                            {matchedFollowers.map((f) => (
                                <View key={`match-${f.id}`} className="mb-4">
                                    <VolunteerRelationCard
                                        volunteer={f}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${f.id}`)}
                                        primaryActionLabel="Invita a questa attività"
                                        onPrimaryAction={() => smartMatchActivity && handleInviteToActivity(f.id, smartMatchActivity.id, smartMatchActivity.title)}
                                        primaryActionStyle="solid"
                                        primaryActionColor={colors.accent}
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
                            estimatedItemSize={200}
                            renderItem={({ item }) => (
                                <VolunteerRelationCard
                                    volunteer={item}
                                    onPress={() => router.push(`/(npo)/volunteer-profile/${item.id}`)}
                                    primaryActionLabel="Invita a diventare volontario"
                                    onPrimaryAction={() => handleInviteToVolunteer(item.id)}
                                    primaryActionStyle="outline"
                                    showActionIcon
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
                    <SectionHeader
                        title="I Tuoi Volontari"
                        description={`Volontari già approvati che fan parte di ${npoDisplayName}.`}
                        style={{ marginBottom: 8 }}
                    />

                    {displayApproved.length > 0 ? (
                        <FlashList
                            data={displayApproved as any[]}
                            keyExtractor={item => item.id}
                            // @ts-ignore
                            estimatedItemSize={230}
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
                                    <VolunteerRelationCard
                                        volunteer={enrichedVolunteer}
                                        applicationMessage={(item as any).message}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${item.volunteerId}`)}
                                        onMessage={() => handleMessageVolunteer(enrichedVolunteer.id, enrichedVolunteer.name, enrichedVolunteer.avatar)}
                                        primaryActionLabel="Invita ad attività"
                                        onPrimaryAction={() => setInviteActivityTarget({ id: enrichedVolunteer.id, name: enrichedVolunteer.name })}
                                        primaryActionStyle="solid"
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

            <InviteToActivityModal
                visible={!!inviteActivityTarget}
                volunteerName={inviteActivityTarget?.name || ''}
                activities={upcomingOpenActivities.map(a => ({ id: a.id, title: a.title, dateTime: a.dateTime }))}
                onClose={() => setInviteActivityTarget(null)}
                onInviteGeneric={() => {
                    if (inviteActivityTarget) handleInviteFollower(inviteActivityTarget.id);
                    setInviteActivityTarget(null);
                }}
                onInviteToActivity={(activityId, activityTitle) => {
                    if (inviteActivityTarget) handleInviteToActivity(inviteActivityTarget.id, activityId, activityTitle);
                    setInviteActivityTarget(null);
                }}
            />
        </StandardLayout>
    );
}
