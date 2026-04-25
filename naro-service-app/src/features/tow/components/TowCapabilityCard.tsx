import { Button, Icon, StatusChip, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Power,
  Truck,
} from "lucide-react-native";
import { Switch, View } from "react-native";

import { useTechnicianProfileStore } from "@/features/technicians";

import { useActiveTowCase, usePendingTowDispatch } from "../api";
import { resolveTowCapability } from "../capability";
import { useTowAvailabilityController } from "../useTowAvailabilityController";

export function TowCapabilityCard() {
  const router = useRouter();
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
  const towAvailability = useTowAvailabilityController(capability.can_show_ui);
  const isActive = towAvailability.isOnline;
  const activeCase = useActiveTowCase(capability.can_activate);
  const activeJob = activeCase.data;
  const incomingQuery = usePendingTowDispatch(capability.can_activate);
  const incoming = incomingQuery.data;

  if (!capability.can_show_ui) {
    return null;
  }

  if (!capability.certificate_approved) {
    return (
      <View className="gap-3 rounded-[22px] border border-app-warning/40 bg-app-warning-soft px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={FileText} size={16} color="#f5b33f" />
          <Text variant="eyebrow" tone="warning">
            Çekici sertifikası gerekli
          </Text>
        </View>
        <Text variant="label" tone="inverse">
          Çekici hizmetini açmak için sertifika yükle
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[17px]"
        >
          Çekici rolü, aracın özel kurtarma yetkisini ve sigorta uyumunu
          gerektirir. Sertifikan onaylandığında &quot;Aktif et&quot; butonu
          görünecek.
        </Text>
        {capability.has_pending_certificate ? (
          <StatusChip label="İnceleniyor · 48 sa içinde sonuç" tone="accent" />
        ) : (
          <Button
            label="Sertifika yükle"
            size="md"
            variant="primary"
            fullWidth
            onPress={() => router.push("/(tabs)/profil")}
          />
        )}
      </View>
    );
  }

  if (activeJob) {
    return (
      <View className="gap-2 rounded-[22px] border border-brand-500/40 bg-brand-500/10 px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={Truck} size={16} color="#0ea5e9" />
          <Text variant="eyebrow" tone="accent">
            Aktif çekici işi
          </Text>
        </View>
        <Text variant="label" tone="inverse">
          {activeJob.stage_label}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          {activeJob.pickup_label ?? "Alınacak konum"}
        </Text>
        <Button
          label="İşi aç"
          size="md"
          variant="primary"
          fullWidth
          onPress={() => router.push(`/cekici/${activeJob.id}`)}
        />
      </View>
    );
  }

  if (incoming) {
    return (
      <View className="gap-2 rounded-[22px] border border-app-warning/40 bg-app-warning-soft px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={AlertCircle} size={16} color="#f5b33f" />
          <Text variant="eyebrow" tone="warning">
            Dispatch ekranı açılıyor
          </Text>
        </View>
        <Text variant="label" tone="inverse">
          {incoming.customer_name} · {incoming.equipment_label}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          {incoming.pickup_label}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon icon={Truck} size={16} color="#0ea5e9" />
          <Text variant="eyebrow" tone="subtle">
            Çekici hizmeti
          </Text>
        </View>
        <Switch
          value={isActive}
          disabled={towAvailability.isPending}
          onValueChange={(next) => {
            void (next
              ? towAvailability.setOnline()
              : towAvailability.setOffline());
          }}
          thumbColor="#ffffff"
          trackColor={{ false: "#1d243d", true: "#0ea5e9" }}
        />
      </View>
      <View className="flex-row items-center gap-2">
        <Icon
          icon={isActive ? CheckCircle2 : Power}
          size={14}
          color={isActive ? "#2dd28d" : "#6f7b97"}
        />
        <Text variant="label" tone={isActive ? "success" : "inverse"}>
          {isActive ? "Aktif · GPS yayında" : "Pasif · dispatch kapalı"}
        </Text>
      </View>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-muted text-[12px] leading-[17px]"
      >
        {isActive
          ? "Yakındaki acil çekici çağrıları sana düşer. Yeni dispatch geldiğinde 15 sn içinde kabul ekranı açılır."
          : "Sertifikan onaylı. Açık olduğunda acil çekici çağrılarını alırsın; kapattığında yeni dispatch gelmez, mevcut işler devam eder."}
      </Text>
      {towAvailability.error ? (
        <Text variant="caption" tone="critical" className="text-[12px]">
          {towAvailability.error}
        </Text>
      ) : null}
      {towAvailability.requiresPaymentAccount ? (
        <Button
          label="Ödeme hesabını tamamla"
          size="md"
          variant="outline"
          fullWidth
          onPress={() => router.push("/(tabs)/profil")}
        />
      ) : null}
    </View>
  );
}
