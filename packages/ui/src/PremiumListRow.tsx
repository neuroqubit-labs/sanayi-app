import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type PremiumListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  badge?: ReactNode;
  className?: string;
};

export function PremiumListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  badge,
  className,
}: PremiumListRowProps) {
  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="inverse" className="flex-1">
            {title}
          </Text>
          {badge}
        </View>
        {subtitle ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon icon={ChevronRight} size={18} color="#6f7b97" /> : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className={[
          "flex-row items-center gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4 active:bg-app-surface-2",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className={[
        "flex-row items-center gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {content}
    </View>
  );
}
