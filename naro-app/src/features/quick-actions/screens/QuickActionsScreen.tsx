import {
  ActionSheetSurface,
  Icon,
  shellMotion,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useRouter } from "expo-router";
import {
  AlertTriangle,
  Heart,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { toneIconColor, toneSurfaceClass } from "@/shared/presentation/tone";

import type { QuickActionItem } from "../types";

type QuickActionCard = QuickActionItem & {
  icon: LucideIcon;
  eyebrow?: string;
};

const ACTIONS: QuickActionCard[] = [
  {
    key: "kaydir",
    label: "Kaydir & Usta Bul",
    description: "Sana onerilen ustalari acik nedenlerle kesfet.",
    route: "/(tabs)/carsi",
    tone: "info",
    icon: Sparkles,
    eyebrow: "En hizli karar",
  },
  {
    key: "kaza",
    label: "Kaza Bildir",
    description: "Panik aninda adim adim ilerleyen guvenli rehber.",
    route: "/(modal)/talep/accident",
    tone: "critical",
    icon: AlertTriangle,
    eyebrow: "Acil durum",
  },
  {
    key: "ariza",
    label: "Ariza Bildir",
    description: "Ses, titresim ve sizinti gibi belirtileri sakince topla.",
    route: "/(modal)/talep/breakdown",
    tone: "warning",
    icon: Wrench,
  },
  {
    key: "bakim",
    label: "Bakim Talebi",
    description: "Planli bakim ihtiyacini hizli bir karara donustur.",
    route: "/(modal)/talep/maintenance",
    tone: "success",
    icon: Heart,
  },
  {
    key: "cekici",
    label: "Cekici Cagir",
    description: "Yolda kalma aninda servis ve cekici baglamini birlestir.",
    route: "/(modal)/talep/towing",
    tone: "neutral",
    icon: Truck,
  },
];

export function QuickActionsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        entering={FadeIn.duration(shellMotion.base)}
        exiting={FadeOut.duration(shellMotion.fast)}
        className="absolute inset-0 bg-black/70"
      >
        <Pressable className="flex-1" onPress={() => router.back()} />
      </Animated.View>

      <SafeAreaView edges={["bottom"]} className="px-3 pb-3">
        <Animated.View
          entering={FadeInDown.duration(shellMotion.slow)}
          exiting={FadeOutDown.duration(shellMotion.base)}
        >
          <ActionSheetSurface
            title="Ne yapmak istersin?"
            description="En sik operasyonlar tek dokunusla acilsin; kritik olanlar en ustte kalsin."
          >
            <View className="gap-3">
              {ACTIONS.map((action) => (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => router.replace(action.route as Href)}
                  className={[
                    "gap-2 rounded-[26px] border px-4 py-4 active:opacity-90",
                    toneSurfaceClass[action.tone],
                  ].join(" ")}
                >
                  {action.eyebrow ? (
                    <TrustBadge label={action.eyebrow} tone={action.tone} />
                  ) : null}
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full border border-white/5 bg-app-surface-2">
                      <Icon
                        icon={action.icon}
                        size={22}
                        color={toneIconColor[action.tone]}
                      />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text variant="h3" tone="inverse">
                        {action.label}
                      </Text>
                      <Text tone="muted" className="text-app-text-muted">
                        {action.description}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </ActionSheetSurface>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
