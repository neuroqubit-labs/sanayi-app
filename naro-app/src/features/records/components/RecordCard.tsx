import { PremiumListRow, Text, TrustBadge } from "@naro/ui";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import type { RecordItem } from "../types";

type RecordCardProps = {
  item: RecordItem;
  prominent?: boolean;
};

export function RecordCard({ item, prominent = false }: RecordCardProps) {
  const router = useRouter();

  if (prominent) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} kaydini ac`}
        onPress={() => router.push(item.route as never)}
        className="gap-4 rounded-[28px] border border-app-outline bg-app-surface px-4 py-4"
      >
        <View className="flex-row items-center justify-between gap-3">
          <TrustBadge label={item.statusLabel} tone={item.statusTone} />
          <Text variant="caption" tone="subtle">
            {item.dateLabel}
          </Text>
        </View>
        <View className="gap-2">
          <Text variant="h3" tone="inverse">
            {item.title}
          </Text>
          <Text tone="muted" className="text-app-text-muted">
            {item.subtitle}
          </Text>
        </View>
        {typeof item.progressValue === "number" ? (
          <View className="gap-2">
            <View className="h-2 rounded-full bg-app-surface-2">
              <View
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${item.progressValue}%` }}
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="label" tone="success">
                {item.amountLabel}
              </Text>
              <Text variant="caption" tone="subtle">
                {item.progressLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} kaydini ac`}
      onPress={() => router.push(item.route as never)}
    >
      <PremiumListRow
        title={item.title}
        subtitle={`${item.subtitle} · ${item.dateLabel}`}
        badge={<TrustBadge label={item.statusLabel} tone={item.statusTone} />}
        trailing={
          item.amountLabel ? (
            <Text variant="label" tone="success">
              {item.amountLabel}
            </Text>
          ) : undefined
        }
      />
    </Pressable>
  );
}
