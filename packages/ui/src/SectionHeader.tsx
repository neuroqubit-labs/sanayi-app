import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onActionPress,
}: SectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between gap-4">
      <View className="flex-1 gap-1.5">
        {eyebrow ? (
          <Text variant="eyebrow" tone="subtle">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h2" tone="inverse">
          {title}
        </Text>
        {description ? (
          <Text tone="muted" className="text-app-text-muted">
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          className="flex-row items-center gap-1 rounded-full px-3 py-2 active:bg-app-surface"
        >
          <Text variant="label" tone="accent">
            {actionLabel}
          </Text>
          <Icon icon={ChevronRight} size={16} color="#0ea5e9" />
        </Pressable>
      ) : null}
    </View>
  );
}
