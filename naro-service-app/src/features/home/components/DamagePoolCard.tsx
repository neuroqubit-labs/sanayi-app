import { Icon, StatusChip, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { AlertCircle, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useCasePool } from "@/features/jobs";

export function DamagePoolCard() {
  const router = useRouter();
  const { data: pool = [] } = useCasePool();
  const damageCount = pool.filter((c) => c.kind === "accident").length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/(tabs)/havuz")}
      className="gap-3 rounded-[26px] border border-app-critical/40 bg-app-critical-soft px-5 py-5 active:opacity-85"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={AlertCircle} size={16} color="#ff7e7e" />
        <Text variant="eyebrow" tone="critical">
          Hasar havuzu
        </Text>
        <View className="flex-1" />
        <StatusChip label={`${damageCount} açık`} tone="critical" />
      </View>
      <Text variant="h3" tone="inverse">
        Kaza + hasar dosyaları
      </Text>
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
        Kaporta / boya / cam ekspertizi bekleyen açık vakalar.
      </Text>
      <View className="flex-row items-center justify-end gap-1 pt-1">
        <Text variant="caption" tone="accent" className="text-[12px]">
          Havuzu aç
        </Text>
        <Icon icon={ChevronRight} size={12} color="#0ea5e9" />
      </View>
    </Pressable>
  );
}
