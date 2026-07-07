import { Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { colors, radius, typography } from "@/theme";

type StatusPillTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

type StatusPillProps = {
  label: string;
  tone?: StatusPillTone;
  icon?: ReactNode;
  style?: ViewStyle;
  testID?: string;
};

const toneStyles: Record<StatusPillTone, { backgroundColor: string; color: string; borderColor: string }> = {
  neutral: { backgroundColor: colors.surfaceSubtle, color: colors.textMuted, borderColor: colors.borderMuted },
  success: { backgroundColor: colors.successSoft, color: colors.successStrong, borderColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft, color: colors.warningStrong, borderColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft, color: colors.dangerStrong, borderColor: colors.dangerSoft },
  info: { backgroundColor: colors.infoSoft, color: colors.infoStrong, borderColor: colors.infoSoft },
  accent: { backgroundColor: colors.accentSoft, color: colors.accent, borderColor: colors.accentSoft },
};

export function StatusPill({ label, tone = "neutral", icon, style, testID }: StatusPillProps) {
  const resolvedTone = toneStyles[tone];

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: radius.pill,
          borderWidth: 1,
          backgroundColor: resolvedTone.backgroundColor,
          borderColor: resolvedTone.borderColor,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          ...typography.caption,
          color: resolvedTone.color,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
