import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Clock, UserPlus, Users, X } from "lucide-react-native";

import { colors, radius, spacing, typography } from "@/theme";
import type { AppActivity } from "../../types";
import { isLastMinute } from "./lowCoverageLogic";

type LowCoverageActivitiesModalProps = {
  visible: boolean;
  activities: AppActivity[];
  onClose: () => void;
  onInviteVolunteers: (activityId: string) => void;
  onInviteFollowers: (activityId: string) => void;
};

function formatStart(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Attivita' dei prossimi giorni con pochi iscritti, aperta dall'avviso della home dell'ente quando sono piu'
 * di una. Ogni attivita' porta all'invito dei volontari dell'ente; entro 48 ore anche ai follower (D08).
 */
export function LowCoverageActivitiesModal({ visible, activities, onClose, onInviteVolunteers, onInviteFollowers }: LowCoverageActivitiesModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: spacing["2xl"] }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Chiudi"
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius["3xl"], padding: spacing.xl }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
              <Text style={[typography.cardTitle, { color: colors.primary, flex: 1, marginRight: spacing.sm }]}>Attività con pochi iscritti</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Chiudi">
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Invita i tuoi volontari a quella che vuoi rinforzare.
            </Text>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {activities.map((activity) => {
                const lastMinute = isLastMinute(activity.dateTime);
                return (
                  <View
                    key={activity.id}
                    style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm }}
                  >
                    <View>
                      <Text numberOfLines={2} style={[typography.bodyStrong, { color: colors.text }]}>{activity.title}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing["2xs"] }}>
                        <Clock size={12} color={lastMinute ? colors.dangerStrong : colors.textSecondary} />
                        <Text style={[typography.caption, { color: lastMinute ? colors.dangerStrong : colors.textSecondary }]}>
                          {formatStart(activity.dateTime)} · {activity.iscritti.length} su {activity.slots} iscritti
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => onInviteVolunteers(activity.id)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}
                    >
                      <UserPlus size={16} color={colors.textInverse} />
                      <Text style={[typography.label, { color: colors.textInverse }]}>Invita i tuoi volontari</Text>
                    </TouchableOpacity>
                    {lastMinute && (
                      <TouchableOpacity
                        onPress={() => onInviteFollowers(activity.id)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        style={{ borderColor: colors.primary, borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}
                      >
                        <Users size={16} color={colors.primary} />
                        <Text style={[typography.label, { color: colors.primary }]}>Inizia a breve: invita i follower</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
