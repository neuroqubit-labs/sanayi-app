import { Icon, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { ArrowUpRight, Briefcase } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useJobsFeed } from "@/features/jobs";

export function ActiveJobsCountCard() {
  const router = useRouter();
  const { data: jobs = [] } = useJobsFeed();
  const activeCount = jobs.length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/(tabs)/islerim")}
      className="gap-3 rounded-[26px] border border-app-outline-strong bg-app-surface-2 px-5 py-5 active:bg-app-surface"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={Briefcase} size={16} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle">
          Aktif işler
        </Text>
      </View>
      <View className="flex-row items-end gap-3">
        <Text variant="h2" tone="inverse">
          {activeCount}
        </Text>
        <View className="pb-1 flex-1">
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            İş takibinde
          </Text>
        </View>
        <View className="pb-1 flex-row items-center gap-1">
          <Text variant="caption" tone="accent" className="text-[12px]">
            Tümünü aç
          </Text>
          <Icon icon={ArrowUpRight} size={12} color="#0ea5e9" />
        </View>
      </View>
    </Pressable>
  );
}
