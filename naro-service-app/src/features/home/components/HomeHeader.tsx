import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { Bell, Search } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useUnreadNotificationCount } from "@/features/notifications";

export function HomeHeader() {
  const router = useRouter();
  const unread = useUnreadNotificationCount();

  return (
    <View className="flex-row items-stretch gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vaka, müşteri veya plaka ara"
        onPress={() => router.push("/(modal)/ara" as Href)}
        className="flex-1 flex-row items-center gap-3 rounded-[24px] border border-app-outline-strong bg-app-surface px-4 py-4 active:bg-app-surface-2"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={Search} size={20} color="#d94a1f" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse">
            Havuzda ara
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Plaka, vaka id, müşteri adı
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bildirimler"
        onPress={() => router.push("/bildirimler" as Href)}
        className="w-[60px] items-center justify-center rounded-[24px] border border-app-outline-strong bg-app-surface active:bg-app-surface-2"
      >
        <View>
          <Icon icon={Bell} size={22} color="#f5f7ff" />
          {unread > 0 ? (
            <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-app-surface bg-app-critical" />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
