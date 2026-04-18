import { Screen, Text } from "@naro/ui";
import { View } from "react-native";

export function RevenueSummaryScreen() {
  return (
    <Screen scroll>
      <View className="gap-4">
        <Text variant="h2">Gelir Özeti</Text>
        <Text tone="calm">Tamamlanan işler, beklenen tahsilatlar ve komisyon detayları burada görünecek.</Text>

        <View className="flex-row gap-3 pt-2">
          <View className="flex-1 items-center gap-1 rounded-xl border border-neutral-200 bg-white p-4">
            <Text tone="muted" variant="caption">
              Brüt (Bu Ay)
            </Text>
            <Text variant="h3">—</Text>
          </View>
          <View className="flex-1 items-center gap-1 rounded-xl border border-neutral-200 bg-white p-4">
            <Text tone="muted" variant="caption">
              Net (Bu Ay)
            </Text>
            <Text variant="h3">—</Text>
          </View>
        </View>

        <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-4">
          <Text variant="h3">Beklenen Tahsilatlar</Text>
          <Text tone="muted" variant="caption">
            Yakında burada olacak.
          </Text>
        </View>

        <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-4">
          <Text variant="h3">Tamamlanan Ödemeler</Text>
          <Text tone="muted" variant="caption">
            Yakında burada olacak.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
