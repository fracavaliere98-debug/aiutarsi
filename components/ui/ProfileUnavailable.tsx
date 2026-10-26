import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Lock } from "lucide-react-native";

import { EmptyState } from "../EmptyState";
import { colors, spacing } from "@/theme";

type ProfileUnavailableProps = {
  onBack: () => void;
};

/**
 * A37 (26/10/2026): profilo di un utente bannato visto da chi non e' admin.
 * Messaggio neutro per decisione di Francesco: non si rivela a terzi la sanzione
 * (stessa schermata che vedrebbe chi apre un account eliminato).
 */
export function ProfileUnavailable({ onBack }: ProfileUnavailableProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Torna indietro"
          style={{ width: spacing["5xl"], height: spacing["5xl"], justifyContent: "center" }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <EmptyState
        icon={Lock}
        title="Profilo non disponibile"
        description="Questo profilo non è più visibile su AiutarSi."
        actionLabel="Torna indietro"
        onAction={onBack}
      />
    </SafeAreaView>
  );
}
