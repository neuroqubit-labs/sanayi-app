import { View } from "react-native";

import { Avatar } from "./Avatar";
import { Text } from "./Text";
import { TrustBadge } from "./TrustBadge";

export type ProfileStat = {
  label: string;
  value: string;
};

export type ProfileSummaryCardProps = {
  name: string;
  subtitle: string;
  badgeLabel?: string;
  stats: ProfileStat[];
};

export function ProfileSummaryCard({
  name,
  subtitle,
  badgeLabel,
  stats,
}: ProfileSummaryCardProps) {
  return (
    <View className="gap-5 rounded-[28px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
      <View className="flex-row items-center gap-4">
        <Avatar name={name} size="xl" />
        <View className="flex-1 gap-1.5">
          <Text variant="h2" tone="inverse">
            {name}
          </Text>
          <Text tone="muted" className="text-app-text-muted">
            {subtitle}
          </Text>
          {badgeLabel ? <TrustBadge label={badgeLabel} tone="info" /> : null}
        </View>
      </View>

      <View className="flex-row gap-3 border-t border-app-outline pt-4">
        {stats.map((stat) => (
          <View key={stat.label} className="flex-1 gap-1">
            <Text variant="h3" tone="inverse">
              {stat.value}
            </Text>
            <Text variant="eyebrow" tone="subtle">
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
