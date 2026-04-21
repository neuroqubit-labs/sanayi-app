import { Icon, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { ChevronRight, Layers } from "lucide-react-native";
import { Pressable, View } from "react-native";

export function QuickQueueRow() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/(tabs)/havuz")}
      className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
        <Icon icon={Layers} size={16} color="#0ea5e9" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          Randevulu havuz
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          Planlı çekici istekleri + açık teklifler
        </Text>
      </View>
      <Icon icon={ChevronRight} size={14} color="#83a7ff" />
    </Pressable>
  );
}
