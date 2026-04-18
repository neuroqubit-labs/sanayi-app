import { Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { List, Power, Sparkles, TrendingUp, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useAvailabilityStore } from "@/features/availability";

export function QuickActionsScreen() {
  const router = useRouter();
  const isAvailable = useAvailabilityStore((s) => s.isAvailable);
  const toggleAvailability = useAvailabilityStore((s) => s.toggle);

  type Action = {
    key: string;
    label: string;
    description: string;
    icon: LucideIcon;
    onPress: () => void;
    accent?: "available" | "unavailable";
  };

  const actions: Action[] = [
    {
      key: "musaitlik",
      label: isAvailable ? "Müsaitliği Kapat" : "Müsaitliği Aç",
      description: isAvailable ? "Yeni iş teklifi almayı durdur." : "Yeni iş tekliflerini almaya başla.",
      icon: Power,
      onPress: toggleAvailability,
      accent: isAvailable ? "available" : "unavailable",
    },
    {
      key: "kampanya-olustur",
      label: "Yeni Kampanya Oluştur",
      description: "Paket ve indirim tanımla.",
      icon: Sparkles,
      onPress: () => router.replace("/(modal)/kampanya-olustur"),
    },
    {
      key: "kampanyalarim",
      label: "Kampanyalarım",
      description: "Aktif ve geçmiş kampanyalar.",
      icon: List,
      onPress: () => router.replace("/(modal)/kampanyalarim"),
    },
    {
      key: "gelir-ozeti",
      label: "Gelir Özeti",
      description: "Brüt, komisyon, net — beklenen ve tahsilatlar.",
      icon: TrendingUp,
      onPress: () => router.replace("/(modal)/gelir-ozeti"),
    },
  ];

  return (
    <Screen>
      <View className="gap-3">
        <View className="pb-2">
          <Text variant="h2">Hızlı İşlemler</Text>
          <Text tone="calm">Ne yapmak istersin?</Text>
        </View>

        {actions.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={a.onPress}
            className="flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 active:bg-neutral-50"
          >
            <View
              className={`h-12 w-12 items-center justify-center rounded-full ${
                a.accent === "available"
                  ? "bg-green-100"
                  : a.accent === "unavailable"
                    ? "bg-neutral-200"
                    : "bg-brand-50"
              }`}
            >
              <Icon
                icon={a.icon}
                size={24}
                color={
                  a.accent === "available"
                    ? "#15803d"
                    : a.accent === "unavailable"
                      ? "#6b7280"
                      : "#d94a1f"
                }
              />
            </View>
            <View className="flex-1">
              <Text variant="body" className="font-semibold">
                {a.label}
              </Text>
              <Text tone="muted" variant="caption">
                {a.description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
