import { ActionSheetSurface, Avatar, Icon, Text, TrustBadge } from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTechnicianProfile } from "../api";
import { getTechnicianCaseEntryOptions } from "../case-entry";

const OPTION_ICON: Record<string, LucideIcon> = {
  accident: ShieldAlert,
  breakdown: Wrench,
  maintenance: Sparkles,
};

const OPTION_TONE: Record<string, "critical" | "warning" | "success"> = {
  accident: "critical",
  breakdown: "warning",
  maintenance: "success",
};

export function TechnicianCaseEntryScreen() {
  const router = useRouter();
  const { technicianId } = useLocalSearchParams<{ technicianId: string }>();
  const { data: profile } = useTechnicianProfile(technicianId ?? "");

  const options = profile ? getTechnicianCaseEntryOptions(profile) : [];

  const handleSelect = (kind: string) => {
    if (!technicianId) return;
    router.replace({
      pathname: "/(modal)/talep/[kind]",
      params: { kind, technicianId },
    } as Href);
  };

  return (
    <View className="flex-1 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/70"
        onPress={() => router.back()}
      />

      <SafeAreaView edges={["bottom"]} className="px-3 pb-3">
        <ActionSheetSurface
          title={
            profile ? `${profile.name} için önce vaka seç` : "Usta yükleniyor"
          }
          description={
            profile
              ? "Randevu istemeden önce ihtiyacını bakım, arıza ya da kaza vakası olarak netleştir."
              : "Seçilen servis yükleniyor…"
          }
        >
          {profile ? (
            <View className="gap-4">
              <View className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5">
                <Avatar name={profile.name} size="lg" />
                <View className="flex-1 gap-0.5">
                  <Text variant="label" tone="inverse">
                    {profile.name}
                  </Text>
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted"
                  >
                    {profile.tagline}
                  </Text>
                </View>
                <TrustBadge label="Usta öncelikli" tone="info" />
              </View>

              <View className="gap-3">
                {options.map((option) => (
                  <Pressable
                    key={option.kind}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} aç`}
                    onPress={() => handleSelect(option.kind)}
                    className="gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4 active:opacity-90"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                        <Icon
                          icon={OPTION_ICON[option.kind] ?? AlertTriangle}
                          size={18}
                          color={
                            option.kind === "accident"
                              ? "#ff6b6b"
                              : option.kind === "maintenance"
                                ? "#2dd28d"
                                : "#f5b33f"
                          }
                        />
                      </View>
                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text
                            variant="label"
                            tone="inverse"
                            className="text-[14px]"
                          >
                            {option.label}
                          </Text>
                          {option.recommended ? (
                            <TrustBadge
                              label="Önerilen"
                              tone={OPTION_TONE[option.kind]}
                            />
                          ) : null}
                        </View>
                        <Text
                          variant="caption"
                          tone="muted"
                          className="text-app-text-muted leading-[18px]"
                        >
                          {option.subtitle}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text
                variant="caption"
                tone="muted"
                className="text-center text-app-text-subtle leading-[18px]"
              >
                Vaka bu servis önceliğiyle açılır. Gerekirse diğer teklifleri
                daha sonra yine görebilirsin.
              </Text>
            </View>
          ) : (
            <Text tone="muted" className="py-4 text-center text-app-text-muted">
              Seçilen servisin bilgisi yükleniyor…
            </Text>
          )}
        </ActionSheetSurface>
      </SafeAreaView>
    </View>
  );
}
