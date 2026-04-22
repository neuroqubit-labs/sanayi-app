import type { ProviderMode } from "@naro/domain";
import { BackButton, Button, Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { Building2, Lock, User } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";

type ModeOption = {
  key: ProviderMode;
  label: string;
  description: string;
  icon: typeof Building2;
};

const MODES: ModeOption[] = [
  {
    key: "business",
    label: "İşletme / Şirket",
    description:
      "Tescilli atölye, vergi levhası + oda kaydı ile çalışıyorsan bu seçenek. Kampanya + ekip araçları açık.",
    icon: Building2,
  },
  {
    key: "individual",
    label: "Bireysel Usta",
    description:
      "Kendi adına çalışan, sabit atölyesi olmayan serbest meslek sahibi. Gereken belge sayısı daha az.",
    icon: User,
  },
];

export default function ProviderModeStep() {
  const router = useRouter();
  const provider_type = useOnboardingStore((s) => s.provider_type);
  const provider_mode = useOnboardingStore((s) => s.provider_mode);
  const setProviderMode = useOnboardingStore((s) => s.setProviderMode);

  const cekiciIndividualBlocked = provider_type === "cekici";

  const selectMode = (mode: ProviderMode) => {
    if (cekiciIndividualBlocked && mode === "individual") return;
    setProviderMode(mode);
  };

  const handleContinue = () => {
    if (!provider_mode) return;
    if (provider_mode === "business") {
      router.push("/(onboarding)/business");
    } else {
      router.push("/(onboarding)/capabilities");
    }
  };

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 2 / 8 · İşletme modu
          </Text>
          <Text variant="h2" tone="inverse">
            Nasıl çalışıyorsun?
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Seçimin belge zorunluluklarını ve ekran düzenini belirler.
          </Text>
        </View>
      </View>

      <View className="gap-2">
        {MODES.map((mode) => {
          const active = provider_mode === mode.key;
          const disabled = cekiciIndividualBlocked && mode.key === "individual";
          return (
            <Pressable
              key={mode.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled }}
              onPress={() => selectMode(mode.key)}
              disabled={disabled}
              className={[
                "flex-row items-start gap-3 rounded-[18px] border px-4 py-4",
                active
                  ? "border-brand-500/40 bg-brand-500/10"
                  : "border-app-outline bg-app-surface",
                disabled ? "opacity-50" : "active:opacity-85",
              ].join(" ")}
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  active ? "bg-brand-500/20" : "bg-app-surface-2"
                }`}
              >
                <Icon
                  icon={mode.icon}
                  size={18}
                  color={active ? "#f45f25" : "#83a7ff"}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Text variant="label" tone="inverse" className="text-[14px]">
                    {mode.label}
                  </Text>
                  {disabled ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-app-surface-2 px-2 py-0.5">
                      <Icon icon={Lock} size={10} color="#6f7b97" />
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-muted text-[10px]"
                      >
                        Çekici için kapalı
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px] leading-[17px]"
                >
                  {mode.description}
                </Text>
                {disabled ? (
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[11px] pt-1"
                  >
                    Çekici rolü için bireysel mod V1'de desteklenmiyor. Vergi
                    levhası + operatör belgesi zorunlu.
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Devam et"
        size="lg"
        disabled={!provider_mode}
        variant={provider_mode ? "primary" : "outline"}
        onPress={handleContinue}
        fullWidth
      />
    </Screen>
  );
}
