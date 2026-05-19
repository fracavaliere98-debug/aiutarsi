import { Text, View, type TextStyle, type ViewStyle } from "react-native";

import { colors, fontWeight, palette, radius, typography } from "@/theme";

type CountBadgeTone = "primary" | "accent" | "neutral" | "inverse";

type CountBadgeProps = {
  count: number;
  active?: boolean;
  tone?: CountBadgeTone;
  max?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
};

const toneStyles: Record<CountBadgeTone, { backgroundColor: string; color: string }> = {
  primary: { backgroundColor: "rgba(56,36,135,0.1)", color: palette.purple725 },
  accent: { backgroundColor: "rgba(205,5,127,0.1)", color: colors.accent },
  neutral: { backgroundColor: colors.surfaceSubtle, color: colors.textMuted },
  inverse: { backgroundColor: "rgba(255,255,255,0.18)", color: colors.textInverse },
};

export function CountBadge({
  count,
  active = false,
  tone = "primary",
  max = 99,
  style,
  textStyle,
  testID,
}: CountBadgeProps) {
  const label = count > max ? `${max}+` : String(count);
  const resolvedTone = active ? toneStyles.inverse : toneStyles[tone];

  return (
    <View
      testID={testID}
      style={[
        {
          minWidth: 20,
          height: 20,
          paddingHorizontal: 6,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          backgroundColor: resolvedTone.backgroundColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            ...typography.caption,
            color: resolvedTone.color,
            lineHeight: 20,
            fontWeight: fontWeight.black,
            includeFontPadding: false,
            textAlign: "center",
            textAlignVertical: "center",
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
