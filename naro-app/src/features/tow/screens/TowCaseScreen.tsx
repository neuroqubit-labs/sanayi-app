import type { TowDispatchStage } from "@naro/domain";
import {
  BackButton,
  Button,
  Icon,
  Screen,
  StatusChip,
  Surface,
  Text,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  MapPin,
  MapPinned,
  Package,
  Receipt,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import { TowMapCanvas } from "../components/TowMapCanvas";
import { TowOtpPanel } from "../components/TowOtpPanel";
import { TowRatingPanel } from "../components/TowRatingPanel";
import { TowTechnicianCard } from "../components/TowTechnicianCard";
import { useTowLiveChannel } from "../hooks/useTowLiveChannel";
import {
  formatTry,
  getTowStagePresentation,
  isActiveStage,
  labelForEquipment,
} from "../presentation";
import { useTowStore } from "../store";

const SEARCHING_STAGES: TowDispatchStage[] = [
  "searching",
  "no_candidate_found",
  "timeout_converted_to_pool",
];

const SCHEDULED_WAITING_STAGES: TowDispatchStage[] = [
  "scheduled_waiting",
];

export function TowCaseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const snapshot = useTowStore((s) =>
    s.cases.find((c) => c.id === id) ?? null,
  );
  const cancel = useTowStore((s) => s.cancel);
  const verifyOtp = useTowStore((s) => s.verifyOtp);
  const submitRating = useTowStore((s) => s.submitRating);
  const simulateTimeout = useTowStore((s) => s.__simulateTimeoutToPool);

  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const liveChannel = useTowLiveChannel(id ?? null);

  const presentation = snapshot ? getTowStagePresentation(snapshot.stage) : null;

  const arrivalOtp = useMemo(() => {
    if (!snapshot) return null;
    // Live WS'ten gelen arrival OTP varsa önce onu göster
    if (liveChannel.pickupOtp) {
      return {
        id: "live-arrival",
        code: liveChannel.pickupOtp,
        purpose: "arrival" as const,
        verified_at: null,
        issued_at: new Date().toISOString(),
      };
    }
    return (
      [...snapshot.otp_challenges]
        .reverse()
        .find((c) => c.purpose === "arrival") ?? null
    );
  }, [snapshot, liveChannel.pickupOtp]);

  const deliveryOtp = useMemo(() => {
    if (!snapshot) return null;
    return (
      [...snapshot.otp_challenges]
        .reverse()
        .find((c) => c.purpose === "delivery") ?? null
    );
  }, [snapshot]);

  if (!snapshot || !presentation) {
    return (
      <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <Text variant="h3" tone="inverse">
            Talep bulunamadı
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text variant="caption" tone="muted" className="text-center">
            Bu talep artık mevcut değil ya da yüklenemedi.
          </Text>
        </View>
      </Screen>
    );
  }

  const request = snapshot.request;
  const fare = request.fare_quote;
  const isSearching = SEARCHING_STAGES.includes(snapshot.stage);
  const isScheduledWaiting = SCHEDULED_WAITING_STAGES.includes(snapshot.stage);
  const hasTechnician = snapshot.assigned_technician !== null;
  const canShowOtp =
    snapshot.stage === "arrived" ||
    snapshot.stage === "loading" ||
    snapshot.stage === "in_transit";
  const showDeliveryOtp =
    (snapshot.stage === "in_transit" || snapshot.stage === "delivered") &&
    deliveryOtp !== null;
  const isTerminal =
    snapshot.stage === "delivered" || snapshot.stage === "cancelled";

  const handleCancel = () => {
    Alert.alert(
      "Talebi iptal et",
      "İptal ederseniz aşama bazlı iptal ücreti uygulanabilir.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal et",
          style: "destructive",
          onPress: () => {
            cancel(snapshot.id, "customer_cancel");
          },
        },
      ],
    );
  };

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <View className="flex-1 gap-0.5">
            <Text variant="eyebrow" tone="subtle">
              {request.mode === "immediate" ? "Hemen çekici" : "Randevulu çekici"} ·{" "}
              {presentation.eyebrow}
            </Text>
            <Text variant="h2" tone="inverse">
              {presentation.title}
            </Text>
          </View>
          <StageChip stage={snapshot.stage} />
        </View>

        {liveChannel.isConnected ? (
          <View className="mx-5 mt-3 flex-row items-center gap-2 rounded-full border border-app-success/40 bg-app-success-soft px-3 py-1 self-start">
            <View className="h-1.5 w-1.5 rounded-full bg-app-success" />
            <Text variant="caption" tone="success" className="text-[11px]">
              Canlı bağlantı
            </Text>
          </View>
        ) : null}

        <View className="px-5 pt-4">
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[13px] leading-[18px]"
          >
            {presentation.description}
          </Text>
        </View>

        {isScheduledWaiting ? null : (
          <View className="mt-4 px-5">
            <TowMapCanvas
              stage={liveChannel.stage ?? snapshot.stage}
              pickup={request.pickup_lat_lng}
              dropoff={request.dropoff_lat_lng}
              current={
                liveChannel.latest
                  ? {
                      lat: liveChannel.latest.lat,
                      lng: liveChannel.latest.lng,
                    }
                  : snapshot.current_location
              }
              etaMinutes={snapshot.eta_minutes}
            />
          </View>
        )}

        <View className="mt-4 gap-4 px-5">
          {isSearching ? (
            <SearchingCard
              attemptCount={snapshot.dispatch_attempts.length}
              onSimulateTimeout={() => simulateTimeout(snapshot.id)}
              canSimulate={snapshot.stage === "searching"}
            />
          ) : null}

          {isScheduledWaiting ? (
            <ScheduledTowWaitingCard />
          ) : null}

          {hasTechnician && snapshot.assigned_technician && !isScheduledWaiting ? (
            <TowTechnicianCard
              technician={snapshot.assigned_technician}
              etaLabel={
                snapshot.eta_minutes !== null && snapshot.eta_minutes > 0
                  ? `${snapshot.eta_minutes} dk`
                  : null
              }
            />
          ) : null}

          {canShowOtp && arrivalOtp ? (
            <TowOtpPanel
              code={arrivalOtp.code}
              purpose="arrival"
              verified={arrivalOtp.verified_at !== null}
              onSubmit={(entered) =>
                verifyOtp(snapshot.id, entered, "arrival")
              }
            />
          ) : null}

          {showDeliveryOtp && deliveryOtp ? (
            <TowOtpPanel
              code={deliveryOtp.code}
              purpose="delivery"
              verified={deliveryOtp.verified_at !== null}
              onSubmit={(entered) =>
                verifyOtp(snapshot.id, entered, "delivery")
              }
            />
          ) : null}

          {snapshot.stage === "delivered" ? (
            <TowRatingPanel
              submittedRating={snapshot.rating}
              onSubmit={(rating, note) =>
                submitRating(snapshot.id, rating, note)
              }
            />
          ) : null}

          {snapshot.stage === "cancelled" ? (
            <CancelledSummary
              reason={snapshot.cancellation_reason}
              fee={snapshot.cancellation_fee}
            />
          ) : null}

          <RequestSummaryCard snapshot={snapshot} />

          <FareSummaryCard
            capAmount={fare.cap_amount}
            finalAmount={snapshot.final_amount}
            mode={request.mode}
            settlement={snapshot.settlement_status}
          />
        </View>
      </ScrollView>

      {!isTerminal ? (
        <View className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
          {isActiveStage(snapshot.stage) && !isScheduledWaiting ? (
            <Button
              label={hasTechnician ? "Operatörü ara" : "Takibi yenile"}
              size="lg"
              fullWidth
              onPress={() => {
                /* Phone is handled inside TowTechnicianCard; this button is a hint */
              }}
              disabled={!hasTechnician}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={handleCancel}
            className="flex-row items-center justify-center gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
          >
            <Icon icon={X} size={14} color="#ff6b6b" />
            <Text variant="label" tone="critical">
              Talebi iptal et
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
          <Button
            label="Ana sayfaya dön"
            size="lg"
            fullWidth
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
      )}
    </Screen>
  );
}

function ScheduledTowWaitingCard() {
  return (
    <Surface
      variant="flat"
      radius="lg"
      className="gap-3 border-brand-500/30 bg-brand-500/10 px-4 py-4"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={Package} size={14} color="#83a7ff" />
        <Text variant="eyebrow" tone="accent">
          Randevu bekleniyor
        </Text>
      </View>
      <Text variant="label" tone="inverse">
        Planlı çekici talebin sıraya alındı.
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-muted text-[12px]"
      >
        Ödeme penceresi açıldığında canlı takip ekranı üzerinden devam edeceğiz.
      </Text>
    </Surface>
  );
}

function StageChip({ stage }: { stage: TowDispatchStage }) {
  const presentation = getTowStagePresentation(stage);
  const toneMap: Record<
    typeof presentation.tone,
    React.ComponentProps<typeof StatusChip>["tone"]
  > = {
    info: "neutral",
    accent: "accent",
    success: "success",
    warning: "warning",
    critical: "critical",
  };
  return <StatusChip label={presentation.eyebrow} tone={toneMap[presentation.tone]} />;
}

function SearchingCard({
  attemptCount,
  onSimulateTimeout,
  canSimulate,
}: {
  attemptCount: number;
  onSimulateTimeout: () => void;
  canSimulate: boolean;
}) {
  return (
    <Surface
      variant="flat"
      radius="lg"
      className="gap-3 border-brand-500/30 bg-brand-500/10 px-4 py-4"
    >
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full bg-brand-500" />
        <Text variant="eyebrow" tone="accent">
          Dispatch aktif
        </Text>
      </View>
      <Text variant="label" tone="inverse">
        {attemptCount === 0
          ? "En yakın çekiciye dispatch gönderildi"
          : `${attemptCount}. dispatch çağrısı`}
      </Text>
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
        Kabul gelmezse otomatik olarak sıradaki operatöre geçeriz. Aday bulunamazsa tekrar deneme seçeneği açılır.
      </Text>
      {canSimulate ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSimulateTimeout}
          className="flex-row items-center justify-center gap-2 rounded-[14px] border border-dashed border-app-outline px-3 py-2 active:bg-app-surface"
        >
          <Icon icon={AlertCircle} size={12} color="#f5b33f" />
          <Text variant="caption" tone="warning" className="text-[11px]">
            Demo: kimse kabul etmedi → havuza çevir
          </Text>
        </Pressable>
      ) : null}
    </Surface>
  );
}

function CancelledSummary({
  reason,
  fee,
}: {
  reason: string | null;
  fee: number | null;
}) {
  return (
    <Surface
      variant="flat"
      radius="lg"
      className="gap-2 border-app-critical/30 bg-app-critical-soft px-4 py-4"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={X} size={14} color="#ff7e7e" />
        <Text variant="eyebrow" tone="critical">
          İptal özeti
        </Text>
      </View>
      {reason ? (
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          Sebep: {reason}
        </Text>
      ) : null}
      <Text variant="label" tone="inverse">
        {fee && fee > 0 ? `${formatTry(fee)} iptal bedeli` : "İptal bedeli uygulanmadı"}
      </Text>
    </Surface>
  );
}

function RequestSummaryCard({
  snapshot,
}: {
  snapshot: ReturnType<typeof useTowStore.getState>["cases"][number];
}) {
  const request = snapshot.request;
  return (
    <Surface
      variant="raised"
      radius="lg"
      className="gap-2.5 px-4 py-4"
    >
      <Text variant="eyebrow" tone="subtle">
        Talep özetin
      </Text>
      <SummaryLine
        icon={MapPin}
        iconColor="#2dd28d"
        label="Alınacak"
        value={request.pickup_label || "—"}
      />
      {request.dropoff_label ? (
        <SummaryLine
          icon={MapPinned}
          iconColor="#ff7e7e"
          label="Varış"
          value={request.dropoff_label}
        />
      ) : null}
      <SummaryLine
        icon={Truck}
        iconColor="#83a7ff"
        label="Ekipman"
        value={labelForEquipment(request.required_equipment)}
      />
      {request.scheduled_at ? (
        <SummaryLine
          icon={Package}
          iconColor="#f5b33f"
          label="Randevu"
          value={new Date(request.scheduled_at).toLocaleString("tr-TR")}
        />
      ) : null}
      {request.kasko.has_kasko ? (
        <SummaryLine
          icon={ShieldCheck}
          iconColor="#2dd28d"
          label="Kasko"
          value={request.kasko.insurer_name ?? "Kasko dosyası açık"}
        />
      ) : null}
    </Surface>
  );
}

function FareSummaryCard({
  capAmount,
  finalAmount,
  mode,
  settlement,
}: {
  capAmount: number;
  finalAmount: number | null;
  mode: "immediate" | "scheduled";
  settlement: string;
}) {
  const paid = finalAmount !== null && settlement === "final_charged";
  return (
    <Surface
      variant="raised"
      radius="lg"
      className="gap-2 px-4 py-4"
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={Receipt} size={14} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle">
          {paid ? "Ödeme özeti" : "Fiyat tavanı"}
        </Text>
      </View>
      <Text variant="h3" tone="accent">
        {formatTry(finalAmount ?? capAmount)}
      </Text>
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
        {paid
          ? "Final ücret tahsil edildi. Fatura kanıt dosyasına işlendi."
          : mode === "immediate"
            ? "Gerçek ücret mesafeye göre hesaplanır; bu tavan aşılmaz."
            : "Teklif kabul edildiğinde fiyat kilitlenir."}
      </Text>
    </Surface>
  );
}

function SummaryLine({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Icon>["icon"];
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon icon={icon} size={14} color={iconColor} />
      <Text variant="caption" tone="muted" className="text-app-text-subtle text-[12px]">
        {label}:
      </Text>
      <Text variant="caption" tone="inverse" className="flex-1 text-[13px]">
        {value}
      </Text>
    </View>
  );
}
