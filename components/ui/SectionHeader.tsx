import { Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { colors, typography } from "@/theme";

type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  rightElement?: ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  rightElement,
  style,
  testID,
}: SectionHeaderProps) {
  return (
    <View testID={testID} style={[{ marginBottom: 12 }, style]}>
      {eyebrow ? (
        <Text
          style={{
            ...typography.overline,
            color: colors.textSubtle,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ ...typography.sectionTitle, color: colors.primary, flex: 1 }}>
          {title}
        </Text>
        {rightElement}
      </View>

      {description ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 4 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
