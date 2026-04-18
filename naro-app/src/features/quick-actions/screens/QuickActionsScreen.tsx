import { Icon, Screen, Text } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { AlertTriangle, Heart, Sparkles, Truck, Wrench, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

type QuickAction = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: Href;
};

const ACTIONS: QuickAction[] = [
  {
    key: "kaza",
    label: "Kaza Bildir",
    description: "Acil durumda tek buton.",
    icon: AlertTriangle,
    route: "/(modal)/kaza-bildir",
  },
  {
    key: "cekici",
    label: "Çekici Çağır",
    description: "Aracın hareket edemiyorsa.",
    icon: Truck,
    route: "/(modal)/cekici-cagir",
  },
  {
    key: "ariza",
    label: "Arıza Bildir",
    description: "Sürülebilir bir arıza var.",
    icon: Wrench,
    route: "/(modal)/ariza-bildir",
  },
  {
    key: "bakim",
    label: "Bakım Talebi",
    description: "Periyodik / planlı bakım.",
    icon: Heart,
    route: "/(modal)/bakim-talebi",
  },
  {
    key: "kaydir",
    label: "Kaydır ve Usta Bul",
    description: "Aracına uygun ustaları keşfet.",
    icon: Sparkles,
    route: "/(modal)/kaydir-usta-bul",
  },
];

export function QuickActionsScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View className="gap-3">
        <View className="pb-2">
          <Text variant="h2">Hızlı Aksiyonlar</Text>
          <Text tone="calm">Ne yapmak istersin?</Text>
        </View>

        {ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={() => router.replace(a.route)}
            className="flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 active:bg-neutral-50"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Icon icon={a.icon} size={24} color="#0284c7" />
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
