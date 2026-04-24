import {
  BackButton,
  Button,
  FlowSummaryRow,
  GuaranteeStrip,
  Icon,
  MaintenanceReminderCard,
  PremiumListRow,
  PressableCard,
  Screen,
  Surface,
  Text,
  TrustBadge,
  VehicleMemoryTimeline,
  useNaroTheme,
  type VehicleMemoryEvent as UiVehicleMemoryEvent,
} from "@naro/ui";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  MessageSquare,
  Wrench,
} from "lucide-react-native";
import { Image, View } from "react-native";

import { useActiveCase } from "@/features/cases";

import { useVehicle } from "../api";
import {
  VEHICLE_FUEL_OPTIONS,
  VEHICLE_KIND_LABELS,
  VEHICLE_TRANSMISSION_LABELS,
} from "../constants";
import { VEHICLE_DETAIL_COPY } from "../copy";
import { useVehicleStore } from "../store";

function fuelLabel(key: string | undefined): string {
  if (!key) return "—";
  const match = VEHICLE_FUEL_OPTIONS.find((opt) => opt.key === key);
  return match?.label ?? "—";
}

export function VehicleDetailScreen() {
  const router = useRouter();
  const { colors } = useNaroTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vehicle } = useVehicle(id ?? "");
  const { data: activeCase } = useActiveCase();
  const setActiveVehicle = useVehicleStore((state) => state.setActiveVehicle);
  const activeVehicleId = useVehicleStore((state) => state.activeVehicleId);

  if (!vehicle) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Araç bulunamadı
        </Text>
        <Button
          label="Geri dön"
          variant="outline"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  const isThisActive = activeVehicleId === vehicle.id;
  const timelineEvents: UiVehicleMemoryEvent[] = vehicle.history.map((event) => ({
    id: event.id,
    kind: event.kind,
    title: event.title,
    subtitle: event.subtitle,
    dateLabel: event.dateLabel,
    badgeLabel: event.badgeLabel,
  }));

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Araç profili
          </Text>
          <Text variant="h2" tone="inverse">
            {vehicle.make} {vehicle.model}
          </Text>
        </View>
      </View>

      {/* Hero */}
      <Surface
        variant="hero"
        radius="sheet"
        className="gap-4 overflow-hidden border-app-outline-strong bg-app-surface-2 p-0"
      >
        {vehicle.photoUri ? (
          <View style={{ aspectRatio: 16 / 10 }}>
            <Image
              source={{ uri: vehicle.photoUri }}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        ) : null}

        <View className="gap-4 px-5 pb-5 pt-5">
          <View className="gap-2">
            <Text
              variant="display"
              tone="inverse"
              className="text-[34px] leading-[38px]"
            >
              {vehicle.plate}
            </Text>
            <Text tone="muted" className="text-app-text-muted">
              {vehicle.make} {vehicle.model} · {vehicle.year}
            </Text>
            <Text tone="muted" className="text-app-text-muted">
              {vehicle.mileageKm.toLocaleString("tr-TR")} km
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {vehicle.vehicleKind ? (
              <TrustBadge
                label={VEHICLE_KIND_LABELS[vehicle.vehicleKind]}
                tone="info"
              />
            ) : null}
            {isThisActive ? (
              <TrustBadge label="Aktif araç" tone="success" />
            ) : null}
          </View>

          {!isThisActive ? (
            <Button
              label="Bu aracı aktif yap"
              variant="outline"
              fullWidth
              onPress={() => setActiveVehicle(vehicle.id)}
            />
          ) : null}
        </View>
      </Surface>

      {/* Aktif vaka kısa yolu */}
      {isThisActive && activeCase ? (
        <PressableCard
          accessibilityRole="button"
          accessibilityLabel="Aktif vakayı aç"
          onPress={() => router.push(`/vaka/${activeCase.id}` as Href)}
          variant="elevated"
          radius="lg"
          className="gap-2 border-brand-500/40 bg-brand-500/10 px-4 py-4"
        >
          <View className="flex-row items-center justify-between gap-3">
            <TrustBadge label="Aktif vaka" tone="accent" />
            <Text variant="caption" tone="subtle">
              {activeCase.updated_at_label}
            </Text>
          </View>
          <Text variant="label" tone="inverse">
            {activeCase.title}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {activeCase.next_action_title ||
              "Bir sonraki adım vakayı açınca görünür."}
          </Text>
        </PressableCard>
      ) : null}

      {/* Bakım hatırlatmaları */}
      {vehicle.maintenanceReminders.length > 0 ? (
        <View className="gap-3">
          <Text variant="h3" tone="inverse">
            Bakım hatırlatmaları
          </Text>
          <View className="gap-3">
            {vehicle.maintenanceReminders.map((reminder) => (
              <MaintenanceReminderCard
                key={reminder.id}
                title={reminder.title}
                subtitle={reminder.subtitle}
                dueLabel={reminder.dueLabel}
                tone={reminder.tone}
                onPress={() => router.push("/(modal)/talep/maintenance" as Href)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Aktif garantiler */}
      <GuaranteeStrip
        items={vehicle.warranties.map((warranty) => ({
          id: warranty.id,
          title: warranty.title,
          untilLabel: warranty.untilLabel,
        }))}
      />

      {/* Teknik bilgiler */}
      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          Teknik bilgiler
        </Text>
        <FlowSummaryRow label="Yakıt" value={fuelLabel(vehicle.fuel)} />
        <FlowSummaryRow
          label="Vites"
          value={
            vehicle.transmission
              ? VEHICLE_TRANSMISSION_LABELS[vehicle.transmission]
              : "—"
          }
        />
        <FlowSummaryRow label="Renk" value={vehicle.color ?? "—"} />
        {vehicle.chassisNo ? (
          <FlowSummaryRow label="Şase no" value={vehicle.chassisNo} />
        ) : null}
        {vehicle.engineNo ? (
          <FlowSummaryRow label="Motor no" value={vehicle.engineNo} />
        ) : null}
      </View>

      {/* Bakım & Sigorta */}
      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          Bakım & Sigorta
        </Text>
        <FlowSummaryRow
          label="Son bakım"
          value={vehicle.lastServiceLabel ?? "Henüz kayıtlı değil"}
        />
        <FlowSummaryRow
          label="Sonraki bakım"
          value={vehicle.nextServiceLabel ?? "Planlanmadı"}
        />
        <FlowSummaryRow
          label="Düzenli servis"
          value={vehicle.regularShop ?? "Tanımlı değil"}
        />
        <FlowSummaryRow
          label="Sigorta bitişi"
          value={vehicle.insuranceExpiryLabel ?? "Belirtilmedi"}
        />
      </View>

      {/* Kronik notlar */}
      {vehicle.chronicNotes.length > 0 ? (
        <Surface
          variant="flat"
          radius="lg"
          className="gap-3 border-app-warning/30 bg-app-warning-soft px-4 py-4"
        >
          <View className="flex-row items-center gap-2">
            <Icon icon={AlertCircle} size={18} color={colors.warning} />
            <Text variant="label" tone="inverse">
              Kronik notlar
            </Text>
          </View>
          <View className="gap-2">
            {vehicle.chronicNotes.map((note, index) => (
              <Text
                key={`${note}-${index}`}
                tone="muted"
                className="text-app-text-muted"
              >
                •  {note}
              </Text>
            ))}
          </View>
        </Surface>
      ) : null}

      {/* Geçmiş / timeline */}
      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          {VEHICLE_DETAIL_COPY.history.sectionTitle}
        </Text>
        <VehicleMemoryTimeline
          events={timelineEvents}
          emptyText="Bu araç için henüz kayıtlı bir işlem yok. İlk vakan sonrası burada kronoloji oluşur."
        />
      </View>

      {/* Hızlı aksiyon dock */}
      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          Hızlı aksiyon
        </Text>
        <PremiumListRow
          title="Bakım talebi başlat"
          subtitle="Plan, tercih ve teslim modunu seç"
          leading={
            <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
              <Icon icon={Wrench} size={16} color={colors.success} />
            </View>
          }
          onPress={() => router.push("/(modal)/talep/maintenance" as Href)}
        />
        <PremiumListRow
          title="Araçla ilgili soru yaz"
          subtitle="Vaka açmadan hızlıca destekten yardım al"
          leading={
            <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
              <Icon icon={MessageSquare} size={16} color={colors.info} />
            </View>
          }
          onPress={() => router.push("/profil/destek" as Href)}
        />
        {/* TB-6: Belgeler & faturalar — /arac/[id]/belgeler route eksik,
            pilot'ta sadece aktif case varsa case-scoped belge linki göster.
            Araç-scoped belge ekranı V1.1'de eklenecek. */}
        {isThisActive && activeCase ? (
          <PremiumListRow
            title="Vaka belgeleri"
            subtitle="Aktif vakaya yüklenen belgeler"
            leading={
              <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                <Icon icon={Wrench} size={16} color={colors.info} />
              </View>
            }
            onPress={() =>
              router.push(`/vaka/${activeCase.id}/belgeler` as Href)
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
