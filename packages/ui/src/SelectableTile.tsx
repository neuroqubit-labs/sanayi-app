import type { ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";

import { Text } from "./Text";

export type SelectableTileProps = Omit<PressableProps, "children"> & {
  title: string;
  description?: string;
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function SelectableTile({
  title,
  description,
  selected = false,
  leading,
  trailing,
  className,
  accessibilityLabel,
  accessibilityRole = "button",
  ...rest
}: SelectableTileProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      className={[
        "min-h-[72px] flex-row items-center gap-3 rounded-[18px] border px-4 py-3 active:opacity-90",
        selected
          ? "border-brand-500/45 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {leading}
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="label" tone={selected ? "accent" : "inverse"}>
          {title}
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
