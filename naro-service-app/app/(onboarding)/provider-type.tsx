import type { ProviderType } from "@naro/domain";
import { BackButton, Button, Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import {
  CircleDot,
  Sparkles,
  SprayCan,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";
import { PROVIDER_TYPE_META, PROVIDER_TYPE_ORDER } from "@/features/technicians";

const ICON_MAP: Record<ProviderType, LucideIcon> = {
  usta: Wrench,
  cekici: Truck,
  oto_aksesuar: Sparkles,
  kaporta_boya: SprayCan,
  lastik: CircleDot,
  oto_elektrik: Zap,
};

export default function ProviderTypeStep() {
  const router = useRouter();
  const selected = useOnboardingStore((s) => s.provider_type);
  const setProviderType = useOnboardingStore((s) => s.setProviderType);

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 1 / 8 · Başvuru
          </Text>
          <Text variant="h2" tone="inverse">
            Hangi tip hizmet veriyorsun?
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Seçtiğin tip havuz, kampanya ve dosya açma gibi araçları şekillendirir.
          </Text>
        </View>
      </View>

      <View className="gap-2">
        {PROVIDER_TYPE_ORDER.map((type) => {
          const meta = PROVIDER_TYPE_META[type];
          const Icn = ICON_MAP[type];
          const active = selected === type;
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setProviderType(type)}
              className={`flex-row items-start gap-3 rounded-[18px] border px-4 py-4 active:opacity-85 ${
                active
                  ? "border-brand-500/40 bg-brand-500/10"
                  : "border-app-outline bg-app-surface"
              }`}
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  active ? "bg-brand-500/20" : "bg-app-surface-2"
                }`}
              >
                <Icon
                  icon={Icn}
                  size={18}
                  color={active ? "#f45f25" : "#83a7ff"}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse" className="text-[14px]">
                  {meta.label}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px] leading-[17px]"
                >
                  {meta.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Devam et"
        size="lg"
        disabled={!selected}
        variant={selected ? "primary" : "outline"}
        onPress={() => router.push("/(onboarding)/provider-mode")}
        fullWidth
      />
    </Screen>
  );
}
