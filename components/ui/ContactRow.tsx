import { Linking, Text, TouchableOpacity, View } from "react-native";
import { Mail, Phone } from "lucide-react-native";

import { colors, radius, spacing, typography } from "@/theme";

type ContactRowKind = "email" | "phone";

type ContactRowProps = {
  kind: ContactRowKind;
  value: string;
  /** Chiamato se il sistema non riesce ad aprire l'app di posta o il telefono. */
  onOpenError?: () => void;
  testID?: string;
};

const copy: Record<ContactRowKind, { label: string; action: string; scheme: string }> = {
  email: { label: "Email", action: "Scrivi a", scheme: "mailto:" },
  phone: { label: "Telefono", action: "Chiama", scheme: "tel:" },
};

export function ContactRow({ kind, value, onOpenError, testID }: ContactRowProps) {
  const { label, action, scheme } = copy[kind];
  const Icon = kind === "email" ? Mail : Phone;

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`${action} ${value}`}
      onPress={() => {
        Linking.openURL(`${scheme}${value.replace(/\s+/g, "")}`).catch(() => onOpenError?.());
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: spacing["5xl"],
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          width: spacing["4xl"],
          height: spacing["4xl"],
          borderRadius: radius.circle,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typography.overline, color: colors.textSubtle, textTransform: "uppercase" }}>{label}</Text>
        <Text selectable numberOfLines={1} style={{ ...typography.bodyLarge, color: colors.text }}>
          {value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
