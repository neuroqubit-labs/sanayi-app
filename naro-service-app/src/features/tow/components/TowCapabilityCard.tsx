import { Button, Icon, StatusChip, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Power,
  Truck,
} from "lucide-react-native";
import { Pressable, Switch, View } from "react-native";

import { useTechnicianProfileStore } from "@/features/technicians";

import { resolveTowCapability } from "../capability";
import { useTowServiceStore } from "../store";

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
  const isActive = useTowServiceStore((s) => s.is_active);
  const activate = useTowServiceStore((s) => s.activate);
  const deactivate = useTowServiceStore((s) => s.deactivate);
  const activeJob = useTowServiceStore((s) => s.active_job);
  const incoming = useTowServiceStore((s) => s.incoming_dispatch);
  const simulateIncoming = useTowServiceStore(
    (s) => s.simulateIncomingDispatch,
  );

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
          {activeJob.customer_name} · {activeJob.vehicle_plate}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          {activeJob.pickup_label}
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
          onValueChange={(next) => (next ? activate() : deactivate())}
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
      {isActive ? (
        <Pressable
          accessibilityRole="button"
          onPress={simulateIncoming}
          className="flex-row items-center justify-center gap-2 rounded-[14px] border border-dashed border-app-outline px-3 py-2.5 active:bg-app-surface-2"
        >
          <Icon icon={AlertCircle} size={12} color="#f5b33f" />
          <Text variant="caption" tone="warning" className="text-[11px]">
            Demo: test dispatch'i gönder
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
