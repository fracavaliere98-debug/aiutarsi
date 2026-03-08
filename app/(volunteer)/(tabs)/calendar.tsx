import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { Colors } from "../../../constants/Colors";
import { useAuth } from "../../../context/AuthContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Calendar as CalendarIcon, List, Bell, Clock, MapPin, Building2 } from "lucide-react-native";
import { UserAvatar } from "../../../components/UserAvatar";
import { StandardLayout } from "../../../components/StandardLayout";
import { VolunteerHeaderActions } from "../../../components/VolunteerHeaderActions";
import { SoftCard } from "../../../components/SoftCard";
import { BadgePill } from "../../../components/BadgePill";
import { useActivities } from "../../../context/ActivityContext";
import { AppActivity } from "../../../types";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "../../../context/ToastContext";
import { CalendarGrid } from "../../../components/CalendarGrid";
import { ActivityCard } from "../../../components/ActivityCard";
import { ErrorState } from "../../../components/ErrorState";

type ViewMode = "list" | "calendar";
type FilterMode = "upcoming" | "completed";

export default function VolunteerCalendar() {
    const { user } = useAuth();
    const router = useRouter();
    const { activities, error, loadData } = useActivities();
    const { showToast } = useToast();


    const params = useLocalSearchParams<{ view?: ViewMode; filter?: FilterMode }>();
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [filterMode, setFilterMode] = useState<FilterMode>("upcoming");

    useEffect(() => {
        if (params.view) setViewMode(params.view);
        if (params.filter) setFilterMode(params.filter);
    }, [params.view, params.filter]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());


    // Get user's enrolled activities
    const enrolledActivities = useMemo(() => {
        return activities.filter(a => a.iscritti.includes(user?.id || ""));
    }, [activities, user?.id]);

    // Filter by upcoming or completed
    const filteredActivities = useMemo(() => {
        if (filterMode === "upcoming") {
            return enrolledActivities.filter(a => a.status === "APERTA" || a.status === "IN_CORSO");
        } else {
            return enrolledActivities.filter(a => a.status === "COMPLETATA");
        }
    }, [enrolledActivities, filterMode]);

    // Group activities by date
    const groupedActivities = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const groups = {
            today: [] as AppActivity[],
            tomorrow: [] as AppActivity[],
            future: [] as AppActivity[], // All upcoming after tomorrow
            past: [] as AppActivity[],   // All past
        };

        filteredActivities.forEach(activity => {
            const activityDate = new Date(activity.dateTime);
            const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());

            if (activityDay.getTime() < today.getTime()) {
                groups.past.push(activity);
            } else if (activityDay.getTime() === today.getTime()) {
                groups.today.push(activity);
            } else if (activityDay.getTime() === tomorrow.getTime()) {
                groups.tomorrow.push(activity);
            } else {
                groups.future.push(activity);
            }
        });

        // Sort 'future' and 'past'
        groups.future.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
        groups.past.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()); // Newest first for past

        return groups;
    }, [filteredActivities]);

    const onRefresh = async () => {
        setRefreshing(true);
        // In a real app, you would re-fetch data here
        await new Promise(resolve => setTimeout(resolve, 1000));
        showToast('success', 'Calendario aggiornato!');
        setRefreshing(false);
    };





    if (error) {
        return (
            <StandardLayout label="La tua Agenda" title="Calendario" bg="bg-background-light">
                <ErrorState
                    title="Errore caricamento"
                    description="Impossibile recuperare il tuo calendario."
                    onRetry={loadData}
                />
            </StandardLayout>
        );
    }

    return (
        <StandardLayout
            label="La tua Agenda"
            title="Calendario"
            rightElement={<VolunteerHeaderActions />}
            bg="bg-background-light"
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.accent}
                    colors={[Colors.accent]}
                />
            }
        >
            {/* View Mode Toggle */}
            <View className={`flex-row bg-slate-100 rounded-2xl p-1 ${viewMode === 'list' ? 'mb-6' : 'mb-2'}`}>
                <TouchableOpacity
                    onPress={() => setViewMode("list")}
                    className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${viewMode === "list" ? "bg-white shadow-sm" : ""
                        }`}
                >
                    <List size={18} color={viewMode === "list" ? Colors.primary : Colors.secondary} />
                    <Text className={`font-bold ${viewMode === "list" ? "text-primary" : "text-secondary"}`}>
                        Lista
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setViewMode("calendar")}
                    className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${viewMode === "calendar" ? "bg-white shadow-sm" : ""
                        }`}
                >
                    <CalendarIcon size={18} color={viewMode === "calendar" ? Colors.primary : Colors.secondary} />
                    <Text className={`font-bold ${viewMode === "calendar" ? "text-primary" : "text-secondary"}`}>
                        Calendario
                    </Text>
                </TouchableOpacity>
            </View>

            {viewMode === "list" ? (
                <>
                    {/* Filter Toggle */}
                    <View className="flex-row gap-4 mb-6">
                        <TouchableOpacity onPress={() => setFilterMode("upcoming")}>
                            <View className="flex-row items-center gap-2">
                                <Text className={`font-black text-base ${filterMode === "upcoming" ? "text-primary" : "text-secondary/40"}`}>
                                    In Arrivo
                                </Text>
                                {filterMode === "upcoming" && (
                                    <View className="w-2 h-2 bg-accent rounded-full" />
                                )}
                            </View>
                            {filterMode === "upcoming" && (
                                <View className="h-1 bg-accent rounded-full mt-1" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setFilterMode("completed")}>
                            <View className="flex-row items-center gap-2">
                                <Text className={`font-black text-base ${filterMode === "completed" ? "text-primary" : "text-secondary/40"}`}>
                                    Completate
                                </Text>
                                {filterMode === "completed" && (
                                    <View className="w-2 h-2 bg-accent rounded-full" />
                                )}
                            </View>
                            {filterMode === "completed" && (
                                <View className="h-1 bg-accent rounded-full mt-1" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Past Section (for completed) */}
                    {filterMode === "completed" && groupedActivities.past.length > 0 && (
                        <View className="mb-8">
                            <Text className="text-xl font-black text-primary mb-4">Attività Passate</Text>
                            {groupedActivities.past.map(activity => (
                                <ActivityCard key={activity.id} activity={activity} onPress={() => router.push(("/activity/" + activity.id) as any)} style={{ marginBottom: 16 }} />
                            ))}
                        </View>
                    )}

                    {/* Today Section */}
                    {filterMode === "upcoming" && groupedActivities.today.length > 0 && (
                        <View className="mb-8">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-xl font-black text-primary">Oggi</Text>
                                <Text className="text-secondary text-sm font-semibold">
                                    {new Date().toLocaleDateString("it-IT", { month: "short", day: "numeric" })}
                                </Text>
                            </View>
                            {groupedActivities.today.map(activity => (
                                <ActivityCard key={activity.id} activity={activity} onPress={() => router.push(("/activity/" + activity.id) as any)} style={{ marginBottom: 16 }} />
                            ))}
                        </View>
                    )}

                    {/* Tomorrow Section */}
                    {filterMode === "upcoming" && groupedActivities.tomorrow.length > 0 && (
                        <View className="mb-8">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-xl font-black text-primary">Domani</Text>
                                <Text className="text-secondary text-sm font-semibold">
                                    {new Date(Date.now() + 86400000).toLocaleDateString("it-IT", { month: "short", day: "numeric" })}
                                </Text>
                            </View>
                            {groupedActivities.tomorrow.map(activity => (
                                <ActivityCard key={activity.id} activity={activity} onPress={() => router.push(("/activity/" + activity.id) as any)} style={{ marginBottom: 16 }} />
                            ))}
                        </View>
                    )}

                    {/* Future Section */}
                    {filterMode === "upcoming" && groupedActivities.future.length > 0 && (
                        <View className="mb-8">
                            {groupedActivities.future.map(activity => (
                                <ActivityCard key={activity.id} activity={activity} onPress={() => router.push(("/activity/" + activity.id) as any)} style={{ marginBottom: 16 }} />
                            ))}
                        </View>
                    )}

                    {/* Empty State */}
                    {groupedActivities.today.length === 0 &&
                        groupedActivities.tomorrow.length === 0 &&
                        groupedActivities.future.length === 0 &&
                        (filterMode === "upcoming" || groupedActivities.past.length === 0) && (
                            <SoftCard className="p-8 items-center">
                                <View className="bg-indigo-50 p-6 rounded-full mb-6">
                                    <CalendarIcon size={48} color={Colors.primary} />
                                </View>
                                <Text className="text-xl font-black text-primary text-center mb-2">
                                    {filterMode === "upcoming" ? "Nessuna attività in programma" : "Nessuna attività completata"}
                                </Text>
                                <Text className="text-secondary text-center mb-6 leading-6">
                                    {filterMode === "upcoming"
                                        ? "Il tuo calendario è libero per la prossima settimana."
                                        : "Non hai ancora completato nessuna attività."}
                                </Text>
                                {filterMode === "upcoming" && (
                                    <TouchableOpacity
                                        onPress={() => router.push("/(volunteer)/search" as any)}
                                        className="bg-accent px-6 py-3 rounded-2xl"
                                    >
                                        <Text className="text-white font-black">Trova Opportunità →</Text>
                                    </TouchableOpacity>
                                )}
                            </SoftCard>
                        )}
                </>
            ) : (
                // Calendar View
                <View className="pb-28">
                    {/* Legend */}
                    <View className="flex-row justify-center gap-6 mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2.5 h-2.5 bg-[#a855f7] rounded-full" />
                            <Text className="text-secondary text-xs font-bold uppercase tracking-wider">In arrivo</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <View className="w-2.5 h-2.5 bg-[#22c55e] rounded-full" />
                            <Text className="text-secondary text-xs font-bold uppercase tracking-wider">Completata</Text>
                        </View>
                    </View>

                    <CalendarGrid
                        activities={enrolledActivities}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                    />

                    <Text className="text-xl font-black text-primary mb-4 mt-4">
                        {
                            selectedDate.toDateString() === new Date().toDateString()
                                ? "Oggi"
                                : selectedDate.toLocaleDateString("it-IT", { weekday: 'long', day: 'numeric', month: 'long' })
                        }
                    </Text>

                    {enrolledActivities.filter(a => new Date(a.dateTime).toDateString() === selectedDate.toDateString()).length > 0 ? (
                        enrolledActivities
                            .filter(a => new Date(a.dateTime).toDateString() === selectedDate.toDateString())
                            .map(activity => (
                                <ActivityCard key={activity.id} activity={activity} onPress={() => router.push(("/activity/" + activity.id) as any)} style={{ marginBottom: 16 }} />
                            ))
                    ) : (
                        <SoftCard className="p-6 items-center border border-dashed border-gray-200 bg-gray-50/50">
                            <Text className="text-secondary font-medium">Nessuna attività per questa data</Text>
                        </SoftCard>
                    )}
                </View>
            )}
        </StandardLayout>
    );
}
