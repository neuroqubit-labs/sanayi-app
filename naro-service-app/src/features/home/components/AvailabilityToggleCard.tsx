import { Icon, Text } from "@naro/ui";
import { CheckCircle2, Power } from "lucide-react-native";
import { Switch, View } from "react-native";

import { useTechnicianProfileStore } from "@/features/technicians";
import { resolveTowCapability } from "@/features/tow";
import { useTowAvailabilityController } from "@/features/tow/useTowAvailabilityController";

export function AvailabilityToggleCard() {
  const provider_type = useTechnicianProfileStore((s) => s.provider_type);
  const secondary_provider_types = useTechnicianProfileStore(
    (s) => s.secondary_provider_types,
  );
  const certificates = useTechnicianProfileStore((s) => s.certificates);
  const capability = resolveTowCapability({
    provider_type,
    secondary_provider_types,
    certificates,
  });
  const canToggle = capability.can_activate;
  const towAvailability = useTowAvailabilityController(capability.can_show_ui);
  const isActive = towAvailability.isOnline;

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon
            icon={isActive ? CheckCircle2 : Power}
            size={16}
            color={isActive ? "#2dd28d" : "#6f7b97"}
          />
          <Text variant="eyebrow" tone={isActive ? "success" : "subtle"}>
            {isActive ? "Çevrimiçi · dispatch aktif" : "Çevrimdışı"}
          </Text>
        </View>
        <Switch
          value={isActive}
          disabled={!canToggle || towAvailability.isPending}
          onValueChange={(next) => {
            void (next
              ? towAvailability.setOnline()
              : towAvailability.setOffline());
          }}
          thumbColor="#ffffff"
          trackColor={{ false: "#1d243d", true: "#0ea5e9" }}
        />
      </View>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-muted text-[12px] leading-[17px]"
      >
        {!canToggle
          ? "Çekici sertifikası onaylandığında dispatch almaya başlayabilirsin."
          : isActive
            ? "Konumun yayında. Yeni çekici çağrısı geldiğinde tam ekran kabul ekranı açılır."
            : "Açtığında çevrendeki acil çağrılar sana düşer. Kapattığında yeni dispatch gelmez."}
      </Text>
    </View>
  );
}
