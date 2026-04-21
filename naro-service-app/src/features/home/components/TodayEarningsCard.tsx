import { Icon, Text } from "@naro/ui";
import { Receipt, TrendingUp } from "lucide-react-native";
import { View } from "react-native";

import { useTowServiceStore } from "@/features/tow";

export function TodayEarningsCard() {
  const completed_count = useTowServiceStore((s) => s.completed_count);
  const total_earnings = useTowServiceStore((s) => s.total_earnings);

  return (
    <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={Receipt} size={14} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle">
          Bugünkü kazanç
        </Text>
      </View>
      <View className="flex-row items-end gap-3">
        <Text variant="h2" tone="accent">
          ₺{total_earnings.toLocaleString("tr-TR")}
        </Text>
        <View className="pb-1">
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {completed_count} iş
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={TrendingUp} size={12} color="#2dd28d" />
        <Text variant="caption" tone="success" className="text-[11px]">
          Haftalık ortalamanın üstünde
        </Text>
      </View>
    </View>
  );
}
