import { Icon, PressableCard, Text } from "@naro/ui";
import { useRouter, type Href } from "expo-router";
import { Car, ChevronRight } from "lucide-react-native";
import { View } from "react-native";

/**
 * HomeScreen empty state — yeni customer için "ilk aracını ekle" nudge'ı.
 *
 * PO vizyonu (mobile-auth-onboarding-strategy 3.2): araç-merkezli model;
 * profile-setup tamamlandıktan sonra HomeScreen feed'inin başında
 * persistent banner. Sert blok değil — kullanıcı feed'i görebilir ama
 * araç ekleme her zaman üstte yönlendirici. Dismissable DEĞİL: aracı
 * olmayan user için tüm akışlar (vaka açma vb.) araç gerektirir; bu
 * banner doğal gate.
 *
 * Aracı olan user'larda HomeScreen'de bu component render edilmez
 * (HomeScreen.tsx içinde `vehicles.length === 0` koşulu).
 */
export function VehicleNudgeBanner() {
  const router = useRouter();
  const ROUTE: Href = "/arac/yeni";
  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel="İlk aracını ekle"
      onPress={() => router.push(ROUTE)}
      variant="elevated"
      radius="lg"
      className="gap-3 border-brand-500/30 bg-brand-500/10 px-4 py-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-500/20">
          <Icon icon={Car} size={20} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse">
            İlk aracını ekle
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted"
            numberOfLines={2}
          >
            İhtiyacın olduğunda usta ve servis bulmak için aracını ekle. 30 saniyede tamamlanır.
          </Text>
        </View>
        <Icon icon={ChevronRight} size={18} color="#83a7ff" />
      </View>
    </PressableCard>
  );
}
