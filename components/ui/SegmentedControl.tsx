import { TouchableOpacity, View, Text, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { colors, palette, radius, typography } from "@/theme";
import { CountBadge } from "./CountBadge";

export type SegmentedControlItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
  icon?: (props: { color: string; active: boolean }) => ReactNode;
  testID?: string;
};

type SegmentedControlProps<T extends string> = {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  testID?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  style,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: "row",
          justifyContent: "center",
          gap: 12,
          marginBottom: 16,
        },
        style,
      ]}
    >
      {items.map((item) => {
        const active = item.value === value;
        const foreground = active ? colors.textInverse : colors.textMuted;

        return (
          <TouchableOpacity
            key={item.value}
            testID={item.testID}
            onPress={() => onChange(item.value)}
            activeOpacity={0.9}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              paddingHorizontal: 8,
              paddingVertical: 0,
              borderRadius: radius.pill,
              justifyContent: "center",
              backgroundColor: active ? palette.purple725 : colors.controlSurface,
              shadowColor: active ? palette.purple725 : colors.controlShadow,
              shadowOffset: { width: 4, height: 4 },
              shadowOpacity: active ? 0.3 : 1,
              shadowRadius: 8,
              elevation: active ? 4 : 2,
              borderWidth: active ? 0 : 1,
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            <View
              style={{
                minHeight: 22,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {item.icon ? (
                <View style={{ width: 16, height: 20, alignItems: "center", justifyContent: "center" }}>
                  {item.icon({ color: foreground, active })}
                </View>
              ) : null}

              <Text
                numberOfLines={1}
                style={{
                  ...typography.label,
                  color: foreground,
                  lineHeight: 20,
                  fontWeight: "600",
                  includeFontPadding: false,
                  textAlignVertical: "center",
                }}
              >
                {item.label}
              </Text>

              {typeof item.count === "number" ? <CountBadge count={item.count} active={active} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
