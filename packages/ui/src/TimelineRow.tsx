import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "./Text";

export type TimelineRowProps = {
  title: string;
  subtitle: string;
  meta: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
};

export function TimelineRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
}: TimelineRowProps) {
  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View className="flex-1 gap-1">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {subtitle}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text variant="caption" tone="subtle">
          {meta}
        </Text>
        {trailing}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-row items-center gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4 active:bg-app-surface-2"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
      {content}
    </View>
  );
}
