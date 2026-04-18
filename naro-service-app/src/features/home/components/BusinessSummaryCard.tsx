import { Text } from "@naro/ui";
import { View } from "react-native";

import { useBusinessSummary } from "../api";

export function BusinessSummaryCard() {
  const { data } = useBusinessSummary();
  if (!data) return null;

  return (
    <View className="gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="h3">{data.businessName}</Text>
        <View
          className={`rounded-full px-3 py-1 ${data.availability ? "bg-green-100" : "bg-neutral-200"}`}
        >
          <Text
            variant="caption"
            className={`font-semibold ${data.availability ? "text-green-700" : "text-neutral-600"}`}
          >
            {data.availability ? "Açık" : "Kapalı"}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 items-center gap-1 rounded-lg bg-brand-50 p-3">
          <Text variant="h2">{data.stats.activeJobs}</Text>
          <Text variant="caption" tone="muted">
            Aktif
          </Text>
        </View>
        <View className="flex-1 items-center gap-1 rounded-lg bg-brand-50 p-3">
          <Text variant="h2">{data.stats.upcoming}</Text>
          <Text variant="caption" tone="muted">
            Hazır
          </Text>
        </View>
        <View className="flex-1 items-center gap-1 rounded-lg bg-brand-50 p-3">
          <Text variant="h2">{data.stats.weeklyJobs}</Text>
          <Text variant="caption" tone="muted">
            Bu Hafta
          </Text>
        </View>
      </View>
    </View>
  );
}
