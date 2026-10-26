import React from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Info, Clock, Flag } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { StandardLayout } from "../components/StandardLayout";
import { SoftCard } from "../components/SoftCard";
import { StatusPill } from "../components/ui";
import { useMyReportsQuery } from "../hooks/my-reports/queries";
import type { MyReport } from "../services/MyReportsService";
import { describeReportTarget, type MyReportOutcome } from "../utils/reportCategory";
import { colors, spacing, typography, radius } from "@/theme";

/**
 * A40 — Esito delle segnalazioni fatte dall'utente. Si apre toccando la notifica "Aggiornamento Segnalazione".
 * Due esiti soli (scelta di Francesco 26/10): mai la sanzione esatta, coerente con A37.
 */
const OUTCOME_COPY: Record<MyReportOutcome, {
    pill: string;
    tone: "success" | "info" | "neutral";
    title: string;
    body: string;
}> = {
    action_taken: {
        pill: "Provvedimenti presi",
        tone: "success",
        title: "Abbiamo preso provvedimenti",
        body: "Grazie: la tua segnalazione ci ha aiutato a tenere sicura la community.",
    },
    no_violation: {
        pill: "Nessuna violazione",
        tone: "info",
        title: "Non abbiamo rilevato violazioni",
        body: "La moderazione non ha trovato violazioni delle regole della community. Se non vuoi più interagire con questa persona, puoi bloccarla dal suo profilo.",
    },
    pending: {
        pill: "In esame",
        tone: "neutral",
        title: "La stiamo esaminando",
        body: "Riceverai una notifica quando la moderazione avrà deciso.",
    },
};

const OUTCOME_ICON: Record<MyReportOutcome, { Icon: typeof CheckCircle2; color: string }> = {
    action_taken: { Icon: CheckCircle2, color: colors.successStrong },
    no_violation: { Icon: Info, color: colors.infoStrong },
    pending: { Icon: Clock, color: colors.textMuted },
};

function formatDay(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/** Il motivo e' salvato come "<Categoria>: <testo>": mostriamo il testo scritto dalla persona. */
function reasonText(reason: string) {
    const idx = reason.indexOf(":");
    return idx > 0 && idx <= 40 ? reason.slice(idx + 1).trim() : reason.trim();
}

function ReportOutcomeCard({ report }: { report: MyReport }) {
    const copy = OUTCOME_COPY[report.outcome];
    const { Icon, color } = OUTCOME_ICON[report.outcome];
    const reason = reasonText(report.reason);

    return (
        <SoftCard style={styles.card}>
            <Text style={styles.meta}>
                Segnalazione del {formatDay(report.createdAt)} · {describeReportTarget(report.contentType)}
            </Text>
            {reason ? (
                <Text style={styles.reason} numberOfLines={2}>
                    {reason}
                </Text>
            ) : null}

            <View style={styles.outcomeRow}>
                <Icon size={22} color={color} />
                <View style={styles.outcomeText}>
                    <Text style={styles.outcomeTitle}>{copy.title}</Text>
                    <Text style={styles.outcomeBody}>{copy.body}</Text>
                </View>
            </View>

            <View style={styles.footerRow}>
                <StatusPill label={copy.pill} tone={copy.tone} />
                {report.resolutionDate ? (
                    <Text style={styles.meta}>Gestita il {formatDay(report.resolutionDate)}</Text>
                ) : null}
            </View>
        </SoftCard>
    );
}

export default function MyReportsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { data, isLoading, isError, refetch, isRefetching } = useMyReportsQuery(user?.id);

    let body: React.ReactNode;
    if (isLoading) {
        body = (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    } else if (isError) {
        body = (
            <View style={styles.centered}>
                <Text style={styles.emptyTitle}>Non riusciamo a caricare le tue segnalazioni</Text>
                <TouchableOpacity onPress={() => void refetch()} style={styles.retryButton} activeOpacity={0.7}>
                    <Text style={styles.retryText}>Riprova</Text>
                </TouchableOpacity>
            </View>
        );
    } else if (!data || data.length === 0) {
        body = (
            <View style={styles.centered}>
                <View style={styles.emptyIcon}>
                    <Flag size={40} color={colors.textSubtle} />
                </View>
                <Text style={styles.emptyTitle}>Nessuna segnalazione</Text>
                <Text style={styles.emptyBody}>Qui vedrai l&apos;esito delle segnalazioni che invii.</Text>
            </View>
        );
    } else {
        body = (
            <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ReportOutcomeCard report={item} />}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
            />
        );
    }

    return (
        <StandardLayout title="Le mie segnalazioni" label="MODERAZIONE" onBack={() => router.back()} noScroll>
            <View style={styles.container}>
                <Text style={styles.intro}>
                    Per rispetto di tutti, non diciamo quale provvedimento è stato preso.
                </Text>
                {body}
            </View>
        </StandardLayout>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, marginTop: spacing.sm },
    intro: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
    list: { paddingBottom: spacing["4xl"] },
    card: { padding: spacing.lg, marginBottom: spacing.md, marginHorizontal: spacing.xs, gap: spacing.md, backgroundColor: colors.surface },
    meta: { ...typography.caption, color: colors.textMuted },
    reason: { ...typography.body, color: colors.textSecondary },
    outcomeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    outcomeText: { flex: 1, gap: spacing.xs },
    outcomeTitle: { ...typography.bodyStrong, color: colors.text },
    outcomeBody: { ...typography.body, color: colors.textSecondary },
    footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing["7xl"], paddingHorizontal: spacing["3xl"], gap: spacing.sm },
    emptyIcon: { backgroundColor: colors.surfaceSubtle, padding: spacing["2xl"], borderRadius: radius.circle, marginBottom: spacing.sm },
    emptyTitle: { ...typography.cardTitle, color: colors.text, textAlign: "center" },
    emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
    retryButton: { marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft, minHeight: 44, justifyContent: "center" },
    retryText: { ...typography.bodyStrong, color: colors.primary },
});
