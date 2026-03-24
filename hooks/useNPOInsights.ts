import { useEffect, useMemo, useState } from "react";
import { useActivities } from "../context/ActivityContext";
import { useApplications } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { gemmaService } from "../services/GemmaService";

export type InsightType = 'SMART_MATCH' | 'PENDING' | 'DROUGHT' | 'STABILITY' | 'MILESTONE';

export interface NPOInsight {
    id: string;
    type: InsightType;
    priority: number;
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
    data?: any;
}

export const useNPOInsights = () => {
    const { user } = useAuth();
    const { activities, activityApplications } = useActivities();
    const { applications: npoApplications } = useApplications();
    const router = useRouter();

    const [mutedIds, setMutedIds] = useState<string[]>([]);
    const [aiContentById, setAiContentById] = useState<Record<string, Pick<NPOInsight, "title" | "description" | "actionLabel">>>({});

    const baseInsights = useMemo(() => {
        if (!user || user.role !== 'NPO') return [];

        const myActivities = activities.filter(a => a.npoId === user.id);
        const myActivityApps = activityApplications.filter(app => {
            const act = myActivities.find(a => a.id === app.activityId);
            return !!act;
        });
        const myNPOApps = npoApplications.filter(app => app.npoId === user.id);
        const foundInsights: NPOInsight[] = [];
        const now = new Date();

        // 1. Smart-Match (Priority 1)
        const urgentGapActivity = myActivities.find(a => {
            if (a.status !== 'APERTA') return false;
            const actDate = new Date(a.dateTime);
            const diffHours = (actDate.getTime() - now.getTime()) / (1000 * 3600);
            const enrollmentRate = a.iscritti.length / a.slots;
            return diffHours > 0 && diffHours < 48 && enrollmentRate < 0.5;
        });

        if (urgentGapActivity) {
            foundInsights.push({
                id: `smart_match_${urgentGapActivity.id}`,
                type: 'SMART_MATCH',
                priority: 1,
                title: "Salvataggio Last Minute 🆘",
                description: `L'attività "${urgentGapActivity.title}" ha pochi iscritti e inizia a breve. Trova subito i rinforzi!`,
                actionLabel: "Trova chi può aiutare",
                onAction: () => {
                    // This will navigate to a special view or just the followers tab with a search filter
                    router.push({
                        pathname: "/(npo)/(tabs)/volunteers",
                        params: { tab: 'FOLLOWERS', activityMatch: urgentGapActivity.id }
                    } as any);
                },
                data: { activityId: urgentGapActivity.id }
            });
        }

        // 2. Pending (Priority 2)
        const allPending = [
            ...myActivityApps.filter(a => a.status === 'PENDING'),
            ...myNPOApps.filter(a => a.status === 'PENDING')
        ];

        const oldPending = allPending.filter(a => {
            const appDate = new Date(a.appliedDate);
            const diffHours = (now.getTime() - appDate.getTime()) / (1000 * 3600);
            return diffHours > 24;
        });

        if (oldPending.length > 3) {
            foundInsights.push({
                id: 'pending_alert',
                type: 'PENDING',
                priority: 2,
                title: "Revisione Profili 📋",
                description: `Hai ${oldPending.length} candidature in attesa da più di 24 ore. Non far aspettare i tuoi volontari!`,
                actionLabel: "Gestisci OldCandidature",
                onAction: () => {
                    router.push("/(npo)/(tabs)/volunteers?tab=CANDIDATURE" as any);
                }
            });
        }

        // 3. Drought (Priority 3)
        const upcomingOpen = myActivities.filter(a => a.status === 'APERTA' && new Date(a.dateTime) > now);
        if (upcomingOpen.length === 0) {
            foundInsights.push({
                id: 'activity_drought',
                type: 'DROUGHT',
                priority: 3,
                title: "Mantieni l'Impatto! ✨",
                description: "Non hai attività in programma per i prossimi 7 giorni. Crea qualcosa di nuovo per la community.",
                actionLabel: "Genera bozza con AI",
                onAction: () => {
                    router.push("/(npo)/create-activity?ai_draft=true" as any);
                }
            });
        }

        // 4. Stability (Priority 4)
        // Simulate "Sold-out in < 24h" by looking for full activities that were created recently
        // Since we don't have created_at on OldActivity interface strictly, let's use a heuristic or just "Full" for now
        const successfulActivity = myActivities.find(a => a.iscritti.length >= a.slots && a.status !== 'CANCELLATA');
        if (successfulActivity) {
            foundInsights.push({
                id: `stability_${successfulActivity.id}`,
                type: 'STABILITY',
                priority: 4,
                title: "Attività a Ruba! 🔥",
                description: `L'attività "${successfulActivity.title}" è andata sold-out. Perché non la rendi ricorrente?`,
                actionLabel: "Rendila ricorrente",
                onAction: () => {
                    router.push({
                        pathname: "/(npo)/create-activity",
                        params: { duplicate: successfulActivity.id, recurrence: 'true' }
                    } as any);
                }
            });
        }

        // 5. Milestone (Priority 5)
        // Sum hours from completed
        const completed = myActivities.filter(a => a.status === 'COMPLETATA');
        const totalHours = completed.reduce((acc, curr) => {
            const start = new Date(curr.dateTime).getTime();
            const end = new Date(curr.endDateTime).getTime();
            return acc + (end - start) / (1000 * 3600);
        }, 0);

        if (totalHours > 10) { // Simple threshold for demo
            foundInsights.push({
                id: 'milestone_celebration',
                type: 'MILESTONE',
                priority: 5,
                title: "Grande Risultato! 🎉",
                description: `Hai generato oltre ${Math.floor(totalHours)} ore di impatto questo mese. Condividi il traguardo!`,
                actionLabel: "Condividi Social",
                onAction: () => {
                    // For now just a toast/placeholder
                    console.log("Sharing milestones...");
                }
            });
        }

        return foundInsights
            .filter(i => !mutedIds.includes(i.id))
            .sort((a, b) => a.priority - b.priority);

    }, [activities, activityApplications, npoApplications, user, mutedIds, router]);

    useEffect(() => {
        const activeIds = new Set(baseInsights.map((insight) => insight.id));
        setAiContentById((prev) => {
            const nextEntries = Object.entries(prev).filter(([id]) => activeIds.has(id));
            return nextEntries.length === Object.keys(prev).length ? prev : Object.fromEntries(nextEntries);
        });
    }, [baseInsights]);

    useEffect(() => {
        let cancelled = false;

        if (!user || user.role !== 'NPO' || baseInsights.length === 0) {
            return;
        }

        gemmaService.getNPOInsightDrafts(
            baseInsights.map((insight) => ({
                id: insight.id,
                type: insight.type,
                title: insight.title,
                description: insight.description,
                actionLabel: insight.actionLabel,
                priority: insight.priority,
            }))
        ).then((result) => {
            if (cancelled || !Array.isArray(result.insights)) return;

            const fallbackById = Object.fromEntries(baseInsights.map((insight) => [insight.id, insight]));
            const nextMap = result.insights.reduce<Record<string, Pick<NPOInsight, "title" | "description" | "actionLabel">>>((acc, insight) => {
                if (!insight?.id || !fallbackById[insight.id]) return acc;
                acc[insight.id] = {
                    title: insight.title || fallbackById[insight.id].title,
                    description: insight.description || fallbackById[insight.id].description,
                    actionLabel: insight.actionLabel || fallbackById[insight.id].actionLabel,
                };
                return acc;
            }, {});

            if (Object.keys(nextMap).length > 0) {
                setAiContentById(nextMap);
            }
        }).catch(() => {
            if (!cancelled) {
                setAiContentById({});
            }
        });

        return () => {
            cancelled = true;
        };
    }, [baseInsights, user]);

    const insights = useMemo(() => {
        return baseInsights.map((insight) => ({
            ...insight,
            title: aiContentById[insight.id]?.title || insight.title,
            description: aiContentById[insight.id]?.description || insight.description,
            actionLabel: aiContentById[insight.id]?.actionLabel || insight.actionLabel,
        }));
    }, [aiContentById, baseInsights]);

    const dismissInsight = (id: string) => {
        setMutedIds(prev => [...prev, id]);
    };

    return { insights, dismissInsight };
};
