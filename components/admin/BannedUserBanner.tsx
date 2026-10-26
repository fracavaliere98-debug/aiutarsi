import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Text, TouchableOpacity, View } from "react-native";
import { Ban } from "lucide-react-native";

import { adminNotificationService } from "../../services/AdminNotificationService";
import { useToast } from "../../context/ToastContext";
import { colors, fontSize, radius, spacing } from "@/theme";

type BannedUserBannerProps = {
  userId: string;
  userName?: string;
};

/**
 * A37 (26/10/2026): solo per l'admin. Sul profilo di un utente bannato mostra il ban, il motivo
 * e "Revoca ban" (conferma esplicita). Gli altri utenti vedono invece ProfileUnavailable.
 */
export function BannedUserBanner({ userId, userName }: BannedUserBannerProps) {
  const { showToast } = useToast();
  const [state, setState] = useState<{ banned: boolean; reason: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await adminNotificationService.getProfileForAdmin(userId);
      setState({ banned: !!profile?.is_banned, reason: (profile?.ban_reason as string | null) ?? null });
    } catch (error) {
      console.error("BannedUserBanner: lettura profilo fallita", error);
      setState(null);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state?.banned) return null;

  const confirmRevoke = () => {
    if (busy) return;
    Alert.alert(
      "Revocare il ban?",
      `${userName || "L'utente"} potrà di nuovo usare l'app e riceverà la notifica "Account riattivato".`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Revoca ban",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await adminNotificationService.revokeBan(userId, "Ban revocato dall'admin dal profilo", `${Platform.OS} ${Platform.Version}`);
              showToast("success", "Ban revocato: l'utente è stato avvisato.");
              await load();
            } catch (error: any) {
              if (String(error?.message || "").includes("not_banned")) {
                showToast("info", "Il ban era già stato revocato.");
                await load();
              } else {
                showToast("error", error?.message || "Revoca non riuscita.");
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={{
        backgroundColor: colors.dangerSoft,
        borderColor: colors.danger,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ban size={20} color={colors.dangerStrong} />
        <Text style={{ color: colors.dangerStrong, fontWeight: "700", fontSize: fontSize.bodyLarge }}>Utente bannato</Text>
      </View>
      {state.reason ? (
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>Motivo: {state.reason}</Text>
      ) : null}
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.bodySmall }}>
        Gli altri utenti vedono «Profilo non disponibile».
      </Text>
      <TouchableOpacity
        onPress={confirmRevoke}
        disabled={busy}
        accessibilityRole="button"
        style={{
          alignSelf: "flex-start",
          minHeight: spacing["5xl"],
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ color: colors.dangerStrong, fontWeight: "700", fontSize: fontSize.body }}>Revoca ban</Text>
      </TouchableOpacity>
    </View>
  );
}
