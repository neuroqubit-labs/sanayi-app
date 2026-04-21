import type { TechnicianCapability } from "@naro/domain";
import { BackButton, Button, Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import {
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";
import { PROVIDER_TYPE_META } from "@/features/technicians";

type CapabilityKey = keyof TechnicianCapability;

const CAPABILITY_META: Record<
  CapabilityKey,
  { label: string; description: string; icon: LucideIcon; color: string }
> = {
  insurance_case_handler: {
    label: "Sigorta dosyası takip",
    description: "Kasko / trafik dosyası açar, sigortaya ileti hazırlarsın.",
    icon: ShieldCheck,
    color: "#83a7ff",
  },
  on_site_repair: {
    label: "Yerinde onarım",
    description: "Müşterinin bulunduğu yerde tamir / teşhis yapabilirsin.",
    icon: Wrench,
    color: "#2dd28d",
  },
  towing_coordination: {
    label: "Çekici koordinasyonu",
    description: "Sahadan aracı alır, atölyeye getirebilirsin.",
    icon: Truck,
    color: "#f5b33f",
  },
  valet_service: {
    label: "Valet / pickup hizmeti",
    description: "Müşteriden aracı alır, teslim sonrası geri götürürsün.",
    icon: Sparkles,
    color: "#0ea5e9",
  },
};

const CAPABILITY_ORDER: CapabilityKey[] = [
  "insurance_case_handler",
  "on_site_repair",
  "towing_coordination",
  "valet_service",
];

export default function CapabilitiesStep() {
  const router = useRouter();
  const providerType = useOnboardingStore((s) => s.provider_type);
  const capabilities = useOnboardingStore((s) => s.capabilities);
  const toggleCapability = useOnboardingStore((s) => s.toggleCapability);
  const updateBusiness = useOnboardingStore((s) => s.updateBusiness);

  useEffect(() => {
    if (!providerType) return;
    const presets = PROVIDER_TYPE_META[providerType].recommendedCapabilities;
    Object.entries(presets).forEach(([key, value]) => {
      const k = key as CapabilityKey;
      if (value && !capabilities[k]) {
        toggleCapability(k);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerType]);

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 3 / 5 · Kapsam
          </Text>
          <Text variant="h2" tone="inverse">
            Hizmet kapsamın
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Tipine göre önerilenler seçildi. Sen de istediğin kombinasyonu uygula.
          </Text>
        </View>
      </View>

      <View className="gap-2">
        {CAPABILITY_ORDER.map((key) => {
          const meta = CAPABILITY_META[key];
          const enabled = capabilities[key] ?? false;
          return (
            <Pressable
              key={key}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled }}
              onPress={() => toggleCapability(key)}
              className={`flex-row items-start gap-3 rounded-[16px] border px-4 py-3.5 active:opacity-85 ${
                enabled
                  ? "border-app-success/40 bg-app-success/10"
                  : "border-app-outline bg-app-surface"
              }`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  enabled ? "bg-app-success/20" : "bg-app-surface-2"
                }`}
              >
                <Icon icon={meta.icon} size={16} color={meta.color} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {meta.label}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[11px] leading-[16px]"
                >
                  {meta.description}
                </Text>
              </View>
              <View
                className={`h-6 w-10 rounded-full ${
                  enabled ? "bg-app-success" : "bg-app-surface-2"
                } justify-center px-0.5`}
              >
                <View
                  className={`h-5 w-5 rounded-full bg-white ${
                    enabled ? "self-end" : "self-start"
                  }`}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Devam et"
        size="lg"
        variant="primary"
        onPress={() => {
          // trigger persist
          updateBusiness({});
          router.push("/(onboarding)/certificates");
        }}
        fullWidth
      />
    </Screen>
  );
}
