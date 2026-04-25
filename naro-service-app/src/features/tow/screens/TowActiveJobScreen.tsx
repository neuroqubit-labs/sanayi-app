import type { LatLng, TowDispatchStage, TowEvidenceKind } from "@naro/domain";
import {
  Avatar,
  BackButton,
  Button,
  ETABadge,
  GpsPulse,
  Icon,
  MapView,
  PinMarker,
  RouteLine,
  Screen,
  StatusChip,
  Surface,
  Text,
  TruckMarker,
  bearingDeg,
  type BroadcasterStatus,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  Camera,
  CheckCircle2,
  MapPin,
  MapPinned,
  Phone,
  Receipt,
  ShieldCheck,
  Truck,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { useTechTowBroadcaster } from "../hooks/useTechTowBroadcaster";
import { type TowActiveJob, useTowServiceStore } from "../store.mock";

const STAGE_LABELS: Record<TowDispatchStage, string> = {
  payment_required: "Ödeme bekleniyor",
  accepted: "Kabul edildi",
  en_route: "Yolda",
  nearby: "Yakında",
  arrived: "Konumda",
  loading: "Yükleniyor",
  in_transit: "Transit",
  delivered: "Teslim edildi",
  searching: "Arıyor",
  cancelled: "İptal",
  timeout_converted_to_pool: "Havuza",
  scheduled_waiting: "Randevu bekleniyor",
  bidding_open: "Teklif topluyor",
  offer_accepted: "Teklif kabul",
  // Canonical BE extra stages (shared domain genişletildi 2026-04-23):
  preauth_failed: "Ödeme reddedildi",
  preauth_stale: "Ön yetki süresi doldu",
};

const EVIDENCE_REQUIREMENTS: {
  stage: TowDispatchStage;
  kind: TowEvidenceKind;
  label: string;
  description: string;
}[] = [
  {
    stage: "arrived",
    kind: "tech_arrival",
    label: "Varış fotoğrafı",
    description: "Araç + etraf + plakayı çerçeveleyecek şekilde 1 kare.",
  },
  {
    stage: "loading",
    kind: "tech_loading",
    label: "Yükleme fotoğrafı",
    description: "Araç platforma güvenli bağlanmış halde.",
  },
  {
    stage: "in_transit",
    kind: "tech_delivery",
    label: "Teslim fotoğrafı",
    description: "Servis girişinde indirme sonrası tek kare.",
  },
];

function dial(number: string) {
  const url = Platform.OS === "ios" ? `telprompt:${number}` : `tel:${number}`;
  Linking.openURL(url).catch(() => undefined);
}

export function TowActiveJobScreen() {
  const router = useRouter();
  const job = useTowServiceStore((s) => s.active_job);
  const markEnRoute = useTowServiceStore((s) => s.markEnRoute);
  const markArrived = useTowServiceStore((s) => s.markArrived);
  const verifyArrival = useTowServiceStore((s) => s.verifyArrivalOtp);
  const markLoading = useTowServiceStore((s) => s.markLoading);
  const markInTransit = useTowServiceStore((s) => s.markInTransit);
  const verifyDelivery = useTowServiceStore((s) => s.verifyDeliveryOtp);
  const submitEvidence = useTowServiceStore((s) => s.submitEvidence);
  const finish = useTowServiceStore((s) => s.finish);

  const broadcaster = useTechTowBroadcaster({
    caseId: job?.id ?? null,
    stage: job?.stage ?? null,
  });

  if (!job) {
    return (
      <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <Text variant="h3" tone="inverse">
            Aktif iş yok
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text variant="caption" tone="muted" className="text-center">
            Şu an aktif çekici işin yok.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <View className="flex-1 gap-0.5">
            <Text variant="eyebrow" tone="subtle">
              Çekici işi · {STAGE_LABELS[job.stage] ?? job.stage}
            </Text>
            <Text variant="h2" tone="inverse">
              {job.customer_name}
            </Text>
          </View>
          <StatusChip
            label={job.eta_minutes > 0 ? `${job.eta_minutes} dk` : "—"}
            tone="accent"
            icon={Truck}
          />
        </View>

        <View className="mt-4 gap-4 px-5">
          <CustomerCard
            name={job.customer_name}
            vehicle_plate={job.vehicle_plate}
            vehicle_description={job.vehicle_description}
            phone={job.customer_phone}
          />

          <TowJobMap
            job={job}
            selfLocation={
              broadcaster.lastSample
                ? {
                    lat: broadcaster.lastSample.lat,
                    lng: broadcaster.lastSample.lng,
                  }
                : job.current_location
            }
            broadcasterStatus={broadcaster.status}
            queueDepth={broadcaster.queueDepth}
          />

          <LocationsCard
            pickup={job.pickup_label}
            dropoff={job.dropoff_label}
          />

          <StageActions
            job={job}
            onEnRoute={markEnRoute}
            onArrived={markArrived}
            onVerifyArrival={verifyArrival}
            onMarkLoading={markLoading}
            onMarkInTransit={markInTransit}
            onVerifyDelivery={verifyDelivery}
            onFinish={finish}
          />

          <EvidenceList
            job={job}
            onSubmit={submitEvidence}
          />

          <FareCard amount={job.request.fare_quote.cap_amount} />

          {job.stage === "delivered" ? (
            <Surface
              variant="flat"
              radius="lg"
              className="gap-2 border-app-success/40 bg-app-success-soft px-4 py-4"
            >
              <View className="flex-row items-center gap-2">
                <Icon icon={CheckCircle2} size={16} color="#2dd28d" />
                <Text variant="eyebrow" tone="success">
                  Tamamlandı
                </Text>
              </View>
              <Text variant="label" tone="inverse">
                İş kaydı havuzdan düşürüldü. Kazanç hesabına yazıldı.
              </Text>
            </Surface>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
        <Button
          label="Müşteriyi ara"
          size="lg"
          fullWidth
          leftIcon={<Icon icon={Phone} size={18} color="#ffffff" />}
          onPress={() => dial(job.customer_phone)}
        />
      </View>
    </Screen>
  );
}

const TRANSIT_STAGES: TowDispatchStage[] = ["in_transit", "delivered"];

function TowJobMap({
  job,
  selfLocation,
  broadcasterStatus,
  queueDepth,
}: {
  job: TowActiveJob;
  selfLocation: LatLng;
  broadcasterStatus: BroadcasterStatus;
  queueDepth: number;
}) {
  const { stage, pickup_lat_lng, dropoff_lat_lng, eta_minutes } = job;
  const showTransitRoute = TRANSIT_STAGES.includes(stage);
  const showTruck = stage !== "delivered" && stage !== "cancelled";

  const routeFrom = showTransitRoute ? pickup_lat_lng : selfLocation;
  const routeTo = showTransitRoute ? dropoff_lat_lng : pickup_lat_lng;

  const fitCoords = useMemo(
    () =>
      [selfLocation, pickup_lat_lng, dropoff_lat_lng].filter(
        (c): c is LatLng => c !== null && c !== undefined,
      ),
    [selfLocation, pickup_lat_lng, dropoff_lat_lng],
  );

  const truckHeading = useMemo(() => {
    const target = showTransitRoute ? dropoff_lat_lng : pickup_lat_lng;
    if (!target || !showTruck) return undefined;
    return bearingDeg(selfLocation, target);
  }, [selfLocation, pickup_lat_lng, dropoff_lat_lng, showTransitRoute, showTruck]);

  const statusLabel = resolveBroadcasterLabel(broadcasterStatus, queueDepth);

  return (
    <View className="gap-2">
      <View style={{ height: 240 }}>
        <MapView
          fitCoords={fitCoords}
          theme="dark"
          className="flex-1"
          hideFallbackBadge
        >
          {pickup_lat_lng ? (
            <PinMarker kind="pickup" coord={pickup_lat_lng} label="Alım" />
          ) : null}
          {dropoff_lat_lng ? (
            <PinMarker kind="dropoff" coord={dropoff_lat_lng} label="Teslim" />
          ) : null}
          {routeFrom && routeTo ? (
            <RouteLine coords={[routeFrom, routeTo]} dotCount={18} />
          ) : null}
          {stage === "arrived" && pickup_lat_lng ? (
            <GpsPulse coord={pickup_lat_lng} color="#2dd28d" />
          ) : null}
          {showTruck ? (
            <TruckMarker coord={selfLocation} heading={truckHeading} pulse />
          ) : null}
          {eta_minutes > 0 && showTruck ? (
            <ETABadge
              minutes={eta_minutes}
              coord={selfLocation}
              tone="accent"
              label="ETA"
            />
          ) : null}
        </MapView>
      </View>

      {statusLabel ? (
        <View className="flex-row items-center gap-2 self-start rounded-full border border-app-outline bg-app-surface-2 px-3 py-1">
          <View
            className={[
              "h-1.5 w-1.5 rounded-full",
              broadcasterStatus === "streaming_foreground" ||
              broadcasterStatus === "streaming_background"
                ? "bg-app-success"
                : broadcasterStatus === "offline_queued"
                  ? "bg-app-warning"
                  : "bg-app-text-subtle",
            ].join(" ")}
          />
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px]"
          >
            {statusLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function resolveBroadcasterLabel(
  status: BroadcasterStatus,
  queueDepth: number,
): string | null {
  switch (status) {
    case "streaming_foreground":
      return "Canlı konum akıyor";
    case "streaming_background":
      return "Arka planda konum";
    case "offline_queued":
      return `Offline · ${queueDepth} ölçüm bekliyor`;
    case "paused":
      return "Duraklatıldı";
    case "awaiting_permission":
      return "Konum izni bekleniyor";
    case "error":
      return "Konum izni yok";
    case "idle":
      return null;
    default:
      return null;
  }
}

function CustomerCard({
  name,
  vehicle_plate,
  vehicle_description,
  phone,
}: {
  name: string;
  vehicle_plate: string;
  vehicle_description: string;
  phone: string;
}) {
  return (
    <Surface
      variant="raised"
      radius="lg"
      className="flex-row items-center gap-3 px-4 py-4"
    >
      <Avatar name={name} size="lg" />
      <View className="flex-1 gap-0.5">
        <Text variant="h3" tone="inverse">
          {name}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {vehicle_description}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-subtle">
          Plaka: {vehicle_plate}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Müşteriyi ara"
        onPress={() => dial(phone)}
        className="h-12 w-12 items-center justify-center rounded-full bg-brand-500 active:bg-brand-600"
      >
        <Icon icon={Phone} size={18} color="#ffffff" />
      </Pressable>
    </Surface>
  );
}

function LocationsCard({
  pickup,
  dropoff,
}: {
  pickup: string;
  dropoff: string | null;
}) {
  return (
    <Surface variant="flat" radius="lg" className="gap-2.5 px-4 py-4">
      <View className="flex-row items-start gap-2.5">
        <Icon icon={MapPin} size={14} color="#2dd28d" />
        <View className="flex-1">
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            Alınacak
          </Text>
          <Text variant="caption" tone="inverse" className="text-[13px]">
            {pickup}
          </Text>
        </View>
      </View>
      {dropoff ? (
        <View className="flex-row items-start gap-2.5">
          <Icon icon={MapPinned} size={14} color="#ff7e7e" />
          <View className="flex-1">
            <Text variant="caption" tone="muted" className="text-app-text-subtle">
              Varış
            </Text>
            <Text variant="caption" tone="inverse" className="text-[13px]">
              {dropoff}
            </Text>
          </View>
        </View>
      ) : null}
    </Surface>
  );
}

function FareCard({ amount }: { amount: number }) {
  return (
    <Surface variant="raised" radius="lg" className="gap-2 px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={Receipt} size={14} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle">
          Kazanç
        </Text>
      </View>
      <Text variant="h3" tone="accent">
        ₺{amount.toLocaleString("tr-TR")}
      </Text>
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
        Teslim doğrulandığında hesaba yazılır. Finalde mesafe/süre denetimi yapılır.
      </Text>
    </Surface>
  );
}

type StageActionsProps = {
  job: TowActiveJob;
  onEnRoute: () => void;
  onArrived: () => void;
  onVerifyArrival: (code: string) => { ok: boolean };
  onMarkLoading: () => void;
  onMarkInTransit: () => void;
  onVerifyDelivery: (code: string) => { ok: boolean };
  onFinish: () => void;
};

function StageActions({
  job,
  onEnRoute,
  onArrived,
  onVerifyArrival,
  onMarkLoading,
  onMarkInTransit,
  onVerifyDelivery,
  onFinish,
}: StageActionsProps) {
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const stage = job.stage;

  useEffect(() => {
    setOtpValue("");
    setOtpError(null);
  }, [stage]);

  const handleVerify = (type: "arrival" | "delivery") => {
    const result =
      type === "arrival" ? onVerifyArrival(otpValue) : onVerifyDelivery(otpValue);
    if (!result.ok) {
      setOtpError("Kod yanlış. Müşteriye tekrar doğrulat.");
      return;
    }
    setOtpError(null);
    setOtpValue("");
  };

  return (
    <View className="gap-3 rounded-[22px] border border-brand-500/30 bg-brand-500/5 px-4 py-4">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full bg-brand-500" />
        <Text variant="eyebrow" tone="accent">
          Aşama aksiyonu
        </Text>
      </View>

      {stage === "accepted" ? (
        <>
          <Text variant="label" tone="inverse">
            Yükle, yola çık ve canlı konumu aç.
          </Text>
          <Button
            label="Yola çıktım"
            size="lg"
            fullWidth
            onPress={onEnRoute}
          />
        </>
      ) : null}

      {stage === "en_route" || stage === "nearby" ? (
        <>
          <Text variant="label" tone="inverse">
            Müşteri konumuna vardığında aşağıdaki butona bas.
          </Text>
          <Button
            label="Konuma ulaştım"
            size="lg"
            fullWidth
            onPress={onArrived}
          />
        </>
      ) : null}

      {stage === "arrived" && !job.arrival_otp_verified ? (
        <>
          <Text variant="label" tone="inverse">
            Müşteriden 4 haneli tanışma kodunu iste.
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
              <TextInput
                value={otpValue}
                onChangeText={setOtpValue}
                placeholder="Tanışma kodu"
                placeholderTextColor="#6f7b97"
                keyboardType="number-pad"
                maxLength={4}
                className="text-base text-app-text"
              />
            </View>
            <Button
              label="Doğrula"
              size="md"
              onPress={() => handleVerify("arrival")}
            />
          </View>
          {otpError ? (
            <Text variant="caption" tone="critical">
              {otpError}
            </Text>
          ) : null}
        </>
      ) : null}

      {stage === "arrived" && job.arrival_otp_verified ? (
        <>
          <Text variant="label" tone="success">
            Tanışma kodu doğrulandı.
          </Text>
          <Button
            label="Yüklemeye başla"
            size="lg"
            fullWidth
            onPress={onMarkLoading}
          />
        </>
      ) : null}

      {stage === "loading" ? (
        <>
          <Text variant="label" tone="inverse">
            Araç platforma sabitlendiğinde transit aşamasına geç.
          </Text>
          <Button
            label="Yüklendi, yola çıkıyorum"
            size="lg"
            fullWidth
            onPress={onMarkInTransit}
          />
        </>
      ) : null}

      {stage === "in_transit" && !job.delivery_otp_verified ? (
        <>
          <Text variant="label" tone="inverse">
            Servis girişinde teslim kodunu al.
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
              <TextInput
                value={otpValue}
                onChangeText={setOtpValue}
                placeholder="Teslim kodu"
                placeholderTextColor="#6f7b97"
                keyboardType="number-pad"
                maxLength={4}
                className="text-base text-app-text"
              />
            </View>
            <Button
              label="Doğrula"
              size="md"
              onPress={() => handleVerify("delivery")}
            />
          </View>
          {otpError ? (
            <Text variant="caption" tone="critical">
              {otpError}
            </Text>
          ) : null}
        </>
      ) : null}

      {stage === "in_transit" && job.delivery_otp_verified ? (
        <>
          <Text variant="label" tone="success">
            Teslim kodu doğrulandı.
          </Text>
          <Button
            label="Teslimi tamamla"
            size="lg"
            fullWidth
            onPress={() => {
              Alert.alert(
                "Teslimi tamamla",
                "İşi kapatıp hesaba yazıyoruz. Onaylıyor musun?",
                [
                  { text: "Vazgeç", style: "cancel" },
                  { text: "Tamamla", onPress: onFinish },
                ],
              );
            }}
          />
        </>
      ) : null}

      {stage === "delivered" ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={ShieldCheck} size={14} color="#2dd28d" />
          <Text variant="label" tone="success">
            Süreç tamamlandı.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EvidenceList({
  job,
  onSubmit,
}: {
  job: TowActiveJob;
  onSubmit: (kind: TowEvidenceKind) => void;
}) {
  const stageOrder: TowDispatchStage[] = [
    "accepted",
    "en_route",
    "nearby",
    "arrived",
    "loading",
    "in_transit",
    "delivered",
  ];
  const currentIndex = stageOrder.indexOf(job.stage);

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <Text variant="eyebrow" tone="subtle">
        Kanıt disiplini
      </Text>
      <View className="gap-2">
        {EVIDENCE_REQUIREMENTS.map((req) => {
          const done = job.evidence_kinds_submitted.includes(req.kind);
          const reqIndex = stageOrder.indexOf(req.stage);
          const locked = reqIndex > currentIndex;
          return (
            <View
              key={req.kind}
              className={[
                "flex-row items-center gap-3 rounded-[16px] border px-3 py-2.5",
                done
                  ? "border-app-success/30 bg-app-success-soft"
                  : locked
                    ? "border-app-outline bg-app-surface-2/60"
                    : "border-brand-500/30 bg-brand-500/10",
              ].join(" ")}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: done
                    ? "#2dd28d26"
                    : locked
                      ? "#6f7b9726"
                      : "#0ea5e926",
                }}
              >
                <Icon
                  icon={done ? CheckCircle2 : Camera}
                  size={16}
                  color={done ? "#2dd28d" : locked ? "#6f7b97" : "#0ea5e9"}
                />
              </View>
              <View className="flex-1">
                <Text
                  variant="label"
                  tone={done ? "success" : locked ? "subtle" : "inverse"}
                  className="text-[13px]"
                >
                  {req.label}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[11px]"
                >
                  {req.description}
                </Text>
              </View>
              {done ? (
                <Text variant="caption" tone="success" className="text-[11px]">
                  Yüklendi
                </Text>
              ) : locked ? (
                <Text variant="caption" tone="muted" className="text-[11px]">
                  Bu aşamada
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSubmit(req.kind)}
                  className="rounded-full bg-brand-500 px-3 py-1.5 active:bg-brand-600"
                >
                  <Text variant="caption" tone="inverse" className="text-[11px]">
                    Yükle (mock)
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
