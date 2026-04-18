import { Screen, Text } from "@naro/ui";
import { View } from "react-native";

import { BusinessSummaryCard } from "../components/BusinessSummaryCard";
import { SectionPlaceholder } from "../components/SectionPlaceholder";

export function HomeScreen() {
  return (
    <Screen scroll>
      <View className="gap-4">
        <BusinessSummaryCard />
        <SectionPlaceholder title="Aktif İşler" hint="Şu anda üzerinde çalıştığın işler." />
        <SectionPlaceholder title="Yaklaşan Randevular" hint="Bu haftaki planlı işler." />
        <Text tone="muted" variant="caption" className="pt-4 text-center">
          Usta ana sayfa iskelet — Faz M3 sonrası gerçek içerikle dolacak.
        </Text>
      </View>
    </Screen>
  );
}
