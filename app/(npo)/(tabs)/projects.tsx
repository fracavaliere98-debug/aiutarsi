import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { UserAvatar } from "../../../components/UserAvatar";
import { useAuth } from "../../../context/AuthContext";
import { useActivities } from "../../../context/ActivityContext";
import { Plus, List, Calendar as CalendarIcon } from "lucide-react-native";
import { StandardLayout } from "../../../components/StandardLayout";
import { EmptyState } from "../../../components/EmptyState";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { CalendarGrid } from "../../../components/CalendarGrid";
import { Colors } from "../../../constants/Colors";
import { useToast } from "../../../context/ToastContext";
import { ErrorState } from "../../../components/ErrorState";
import { ActivityCard } from "../../../components/ActivityCard";

type ViewMode = "list" | "calendar";

export default function NPOCalendarScreen() {
    const { user } = useAuth();
    const { activities, error, loadData } = useActivities();
    const router = useRouter();
    const { showToast } = useToast();

    if (error) {
        return (
            <StandardLayout label="Gestione" title="Calendario Attività">
                <ErrorState
                    title="Errore caricamento"
                    description="Impossibile recuperare i tuoi progetti."
                    onRetry={loadData}
                />
            </StandardLayout>
        );
    }

    const [viewMode, setViewMode] = useState<ViewMode>("calendar");
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    // Filter activities created by this NPO and sort by date descending (newest/future first)
    const myProjects = useMemo(() => {
        return activities
            .filter(a => a.npoId === user?.id)
            .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    }, [activities, user]);

    const onRefresh = async () => {
        setRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        showToast('success', 'Calendario aggiornato');
        setRefreshing(false);
    };

    const HeaderActions = (
        <View className="flex-row items-center gap-3">
            <TouchableOpacity
                onPress={() => router.push("/(npo)/create-activity")}
                className="bg-accent p-3 rounded-2xl shadow-lg active:scale-90"
            >
                <Plus size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/(tabs)/profile")}
                className="active:scale-95"
            >
                <UserAvatar size={40} fontSize={14} useAuthFallback={true} />
            </TouchableOpacity>
        </View>
    );

    // Filter projects for selected date in calendar mode
    const selectedDateProjects = useMemo(() => {
        return myProjects.filter(p => new Date(p.dateTime).toDateString() === selectedDate.toDateString());
    }, [myProjects, selectedDate]);

    return (
        <StandardLayout
            label="Gestione"
            title="Calendario Attività"
            rightElement={HeaderActions}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
            }
        >
            {/* View Mode Toggle */}
            <View className="flex-row bg-slate-100 rounded-2xl p-1 mb-6">
                <TouchableOpacity
                    onPress={() => setViewMode("calendar")}
                    className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${viewMode === "calendar" ? "bg-white shadow-sm" : ""}`}
                >
                    <CalendarIcon size={18} color={viewMode === "calendar" ? Colors.primary : Colors.secondary} />
                    <Text className={`font-bold ${viewMode === "calendar" ? "text-primary" : "text-secondary"}`}>
                        Calendario
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setViewMode("list")}
                    className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${viewMode === "list" ? "bg-white shadow-sm" : ""}`}
                >
                    <List size={18} color={viewMode === "list" ? Colors.primary : Colors.secondary} />
                    <Text className={`font-bold ${viewMode === "list" ? "text-primary" : "text-secondary"}`}>
                        Lista
                    </Text>
                </TouchableOpacity>
            </View>

            {viewMode === "calendar" ? (
                <View>
                    <CalendarGrid
                        activities={myProjects}
                        onSelectDate={setSelectedDate}
                        selectedDate={selectedDate}
                    />

                    <Text className="text-xl font-black text-primary mb-4 capitalize">
                        {selectedDate.toDateString() === new Date().toDateString()
                            ? "Oggi"
                            : selectedDate.toLocaleDateString("it-IT", { weekday: 'long', day: 'numeric', month: 'long' })
                        }
                    </Text>

                    {selectedDateProjects.length > 0 ? (
                        <View>
                            {selectedDateProjects.map(project => (
                                <View key={project.id} className="mb-4">
                                    <ActivityCard activity={project} onPress={() => router.push(`/activity/${project.id}` as any)} />
                                </View>
                            ))}
                        </View>
                    ) : (
                        <EmptyState
                            emoji="📅"
                            title="Nessuna Attività"
                            description="Non ci sono attività programmate per questa data."
                        />
                    )}
                </View>
            ) : (
                /* List View */
                <View>
                    {myProjects.length === 0 ? (
                        <EmptyState
                            emoji="📋"
                            title="Nessun Progetto"
                            description="Crea la tua prima attività per iniziare a coinvolgere volontari"
                            actionLabel="Crea Attività"
                            onAction={() => router.push("/(npo)/create-activity")}
                        />
                    ) : (
                        <View>
                            {myProjects.map((project) => (
                                <View key={project.id} className="mb-4">
                                    <ActivityCard activity={project} onPress={() => router.push(`/activity/${project.id}` as any)} />
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </StandardLayout>
    );
}
