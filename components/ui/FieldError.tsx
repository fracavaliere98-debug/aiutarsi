import { Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";

import { colors, spacing, typography } from "@/theme";

type FieldErrorProps = {
  /** Messaggio da mostrare sotto il campo; se vuoto non rende nulla. */
  message?: string | null;
  testID?: string;
};

/** Messaggio di errore sotto un campo del modulo (es. campo obbligatorio non compilato). */
export function FieldError({ message, testID }: FieldErrorProps) {
  if (!message) return null;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, marginLeft: spacing.xs }}
    >
      <AlertCircle size={14} color={colors.dangerStrong} />
      <Text style={[typography.caption, { color: colors.dangerStrong, flexShrink: 1 }]}>{message}</Text>
    </View>
  );
}

type RequiredMarkProps = { testID?: string };

/** Asterisco rosso accanto all'etichetta di un campo obbligatorio. */
export function RequiredMark({ testID }: RequiredMarkProps) {
  return (
    <Text testID={testID} accessibilityLabel="obbligatorio" style={{ color: colors.dangerStrong }}>
      {" *"}
    </Text>
  );
}

/** Riga che spiega il significato dell'asterisco, da mettere in cima al modulo. */
export function RequiredFieldsNote() {
  return (
    <Text style={[typography.caption, { color: colors.textSecondary }]}>
      I campi con <Text style={{ color: colors.dangerStrong }}>*</Text> sono obbligatori.
    </Text>
  );
}
