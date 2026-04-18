import { Screen, Text } from "@naro/ui";
import { View } from "react-native";

import { ActiveProcessBanner } from "../components/ActiveProcessBanner";
import { SectionPlaceholder } from "../components/SectionPlaceholder";
import { VehicleSelectorCard } from "../components/VehicleSelectorCard";

export function HomeScreen() {
  return (
    <Screen scroll>
      <View className="gap-4">
        <VehicleSelectorCard />
        <ActiveProcessBanner />
        <SectionPlaceholder title="Son Aktivite" hint="Teklifler, servis güncellemeleri ve faturalar burada." />
        <SectionPlaceholder title="Sana Özel Ustalar" hint="Aracına uygun usta önerileri." />
        <SectionPlaceholder title="Bakım Kampanyaları" hint="Sana özel fırsatlar." />
        <SectionPlaceholder title="Yakındaki Servisler" hint="Konumuna yakın ustalar." />
        <Text tone="muted" variant="caption" className="pt-4 text-center">
          Ana sayfa iskelet — Faz M2 sonrası her kart gerçek içerikle dolacak.
        </Text>
      </View>
    </Screen>
  );
}
