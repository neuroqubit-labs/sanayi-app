import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type ProfileSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onEdit?: () => void;
  editLabel?: string;
  accessory?: ReactNode;
};

export function ProfileSection({
  title,
  description,
  children,
  onEdit,
  editLabel = "Düzenle",
  accessory,
}: ProfileSectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-start justify-between gap-3 px-4">
        <View className="flex-1 gap-0.5">
          <Text variant="h3" tone="inverse" className="text-[15px]">
            {title}
          </Text>
          {description ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
            >
              {description}
            </Text>
          ) : null}
        </View>
        {accessory ? <View className="shrink-0">{accessory}</View> : null}
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            onPress={onEdit}
            className="rounded-full border border-app-outline px-3 py-1 active:opacity-80"
          >
            <Text variant="caption" tone="inverse" className="text-[11px]">
              {editLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

type HeroMetricProps = {
  icon: LucideIcon;
  iconColor: string;
  value: string;
  label: string;
};

export function HeroMetric({ icon, iconColor, value, label }: HeroMetricProps) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-2 py-2.5">
      <Icon icon={icon} size={14} color={iconColor} strokeWidth={2.5} />
      <Text variant="label" tone="inverse" className="text-[13px]">
        {value}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[11px]"
      >
        {label}
      </Text>
    </View>
  );
}

export type { HeroMetricProps };
