import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle } from "lucide-react-native";
import { ActivityCard } from "../../components/ActivityCard";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { StandardLayout } from "../../components/StandardLayout";
import { useAuth } from "../../context/AuthContext";
import { useActivitiesDomain } from "../../hooks/activities/selectors";
import { AppUser } from "../../types";
import { colors } from "@/theme";

type ActivityFilter = "APERTA" | "COMPLETATA";

const filterOptions: { value: ActivityFilter; label: string }[] = [
    { value: "APERTA", label: "Aperte" },
    { value: "COMPLETATA", label: "Completate" },
];

export default function NPOActivitiesScreen() {
    const { id } = useLocalSearchParams();
    const npoId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
    const router = useRouter();
    const { usersDB: users, fetchUserById } = useAuth();
    const { activities, error, loadData } = useActivitiesDomain(undefined);
    const [activeFilter, setActiveFilter] = useState<ActivityFilter>("APERTA");
    const [fetchedNpo, setFetchedNpo] = useState<AppUser | null>(null);
    const [isFetchingNpo, setIsFetchingNpo] = useState(false);

    useEffect(() => {
        const existing = users.find((candidate) => candidate.id === npoId && candidate.role === "NPO");
        if (existing || !npoId) return;

        let cancelled = false;
        setIsFetchingNpo(true);
        fetchUserById(npoId)
            .then((profile) => {
                if (!cancelled) setFetchedNpo(profile);
            })
            .catch((fetchError) => {
                console.error("Error fetching NPO activities owner:", fetchError);
            })
            .finally(() => {
                if (!cancelled) setIsFetchingNpo(false);
            });

        return () => {
            cancelled = true;
        };
    }, [fetchUserById, npoId, users]);

    const npoUser = users.find((candidate) => candidate.id === npoId && candidate.role === "NPO") || fetchedNpo;

    const filteredActivities = useMemo(() => {
        return activities
            .filter((activity) => activity.npoId === npoId && activity.status === activeFilter)
            .sort((a, b) => {
                const dateA = new Date(a.dateTime).getTime();
                const dateB = new Date(b.dateTime).getTime();
                return activeFilter === "APERTA" ? dateA - dateB : dateB - dateA;
            });
    }, [activeFilter, activities, npoId]);

    if (isFetchingNpo) {
        return (
            <StandardLayout title="Attività" label="Profilo Ente" onBack={() => router.back()}>
                <View className="flex-1 items-center justify-center p-10">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="text-secondary mt-4 font-medium">Carico le attività dell{"'"}ente...</Text>
                </View>
            </StandardLayout>
        );
    }

    if (!npoId || (!npoUser && !isFetchingNpo)) {
        return (
            <StandardLayout title="Attività" label="Profilo Ente" onBack={() => router.back()}>
                <View className="flex-1 items-center justify-center p-10">
                    <AlertTriangle size={48} color={colors.accent} style={{ marginBottom: 16 }} />
                    <Text className="text-primary font-bold text-lg mb-2">Ente non trovato</Text>
                    <Text className="text-secondary text-center mb-6">
                        Non siamo riusciti a trovare le attività per questo ente.
                    </Text>
                    <TouchableOpacity onPress={() => router.back()} className="bg-primary px-6 py-3 rounded-full">
                        <Text className="text-white font-bold">Torna indietro</Text>
                    </TouchableOpacity>
                </View>
            </StandardLayout>
        );
    }

    return (
        <StandardLayout
            title="Attività"
            label={npoUser?.npoName || npoUser?.name || "Profilo Ente"}
            bg="bg-background-light"
            onBack={() => router.back()}
            refreshControl={undefined}
        >
            <View className="mb-5">
                <Text className="text-primary font-black text-2xl mb-1">
                    {npoUser?.npoName || npoUser?.name || "Ente"}
                </Text>
                <Text className="text-secondary text-sm font-medium">
                    Tutte le attività dell{"'"}ente in vista lista.
                </Text>
            </View>

            <View className="flex-row gap-3 mb-5">
                {filterOptions.map((option) => {
                    const isActive = activeFilter === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            onPress={() => setActiveFilter(option.value)}
                            activeOpacity={0.85}
                            className="flex-1 rounded-full items-center justify-center"
                            style={{
                                minHeight: 42,
                                backgroundColor: isActive ? colors.primary : "#f0f2f5",
                                borderWidth: isActive ? 0 : 1,
                                borderColor: "rgba(255,255,255,0.5)",
                            }}
                        >
                            <Text
                                style={{
                                    color: isActive ? "white" : colors.textSecondary,
                                    fontSize: 13,
                                    fontWeight: "800",
                                }}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {error ? (
                <ErrorState
                    title="Errore attività"
                    description="Non siamo riusciti a caricare le attività dell'ente."
                    onRetry={loadData}
                />
            ) : filteredActivities.length > 0 ? (
                <View className="pb-8">
                    {filteredActivities.map((activity) => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            style={{ marginBottom: 16 }}
                            onPress={() => router.push(`/activity/${activity.id}` as any)}
                        />
                    ))}
                </View>
            ) : (
                <EmptyState
                    title={activeFilter === "APERTA" ? "Nessuna attività aperta" : "Nessuna attività completata"}
                    description={
                        activeFilter === "APERTA"
                            ? "Questo ente non ha attività aperte al momento."
                            : "Questo ente non ha ancora attività completate visibili."
                    }
                />
            )}
        </StandardLayout>
    );
}
