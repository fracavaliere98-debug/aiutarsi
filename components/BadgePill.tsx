import { View, Text } from "react-native";
import { ReactNode } from "react";
import { colors } from "@/theme";

type Tone = "primary" | "accent" | "neutral" | "success" | "warning" | "danger" | "info";

interface BadgePillProps {
  label: string;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

const TONE_STYLE: Record<Tone, { bg: string; text: string }> = {
  primary: { bg: colors.infoSoft, text: colors.primary },
  accent:  { bg: colors.dangerSoft, text: colors.accent },
  neutral: { bg: colors.surfaceSubtle, text: colors.textMuted },
  success: { bg: colors.successSoft, text: colors.successStrong },
  warning: { bg: colors.warningSoft, text: colors.warningStrong },
  danger:  { bg: colors.dangerSoft, text: colors.dangerStrong },
  info:    { bg: colors.infoSoft, text: colors.infoStrong },
};

export function BadgePill({ label, icon, tone = "accent", className = "" }: BadgePillProps) {
  const { bg, text } = TONE_STYLE[tone];
  return (
    <View
      className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${className}`}
      style={{ backgroundColor: bg }}
    >
      {icon}
      <Text className="text-xs font-bold" style={{ color: text }}>
        {label}
      </Text>
    </View>
  );
}
