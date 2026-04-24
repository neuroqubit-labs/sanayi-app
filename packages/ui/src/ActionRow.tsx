import type { ReactNode } from "react";
import {
  Pressable,
  View,
  type Insets,
  type PressableProps,
} from "react-native";

import { Text } from "./Text";

export type ActionRowProps = Omit<PressableProps, "children"> & {
  label: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

const DEFAULT_HIT_SLOP: Insets = { bottom: 8, left: 8, right: 8, top: 8 };

export function ActionRow({
  label,
  description,
  leading,
  trailing,
  className,
  accessibilityLabel,
  accessibilityRole = "button",
  hitSlop,
  ...rest
}: ActionRowProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole}
      hitSlop={hitSlop ?? DEFAULT_HIT_SLOP}
      className={[
        "min-h-[56px] flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {leading}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="label" tone="inverse" numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted"
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
