import {
  BackButton,
  Button,
  Icon,
  Screen,
  StatusChip,
  Text,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  Camera,
  KeyRound,
  MapPin,
  Truck,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { useServiceMediaUpload } from "@/shared/media/useServiceMediaUpload";

import {
  useIssueTowOtp,
  useRegisterTowEvidence,
  useTowCaseSnapshotTech,
  useTowTrackingTech,
  useTransitionTowStage,
  useVerifyTowOtpTech,
} from "../api";
import { useTechTowBroadcaster } from "../hooks/useTechTowBroadcaster";
import type {
  TowCaseSnapshot,
  TowDispatchStage,
  TowEvidenceKind,
  TowStageTransitionInput,
} from "../schemas";

const STAGE_LABELS: Record<TowDispatchStage, string> = {
  searching: "Arıyor",
  accepted: "Kabul edildi",
  en_route: "Yolda",
  nearby: "Yakında",
  arrived: "Konumda",
  loading: "Yükleniyor",
  in_transit: "Transit",
  delivered: "Teslim edildi",
  cancelled: "İptal",
  timeout_converted_to_pool: "Havuza düştü",
  scheduled_waiting: "Randevu bekleniyor",
  bidding_open: "Teklif topluyor",
  offer_accepted: "Teklif kabul",
  preauth_failed: "Ödeme reddedildi",
  preauth_stale: "Ön yetki süresi doldu",
};

const EVIDENCE_STEPS: {
  kind: TowEvidenceKind;
  label: string;
  description: string;
  activeStages: TowDispatchStage[];
}[] = [
  {
    kind: "tech_arrival",
    label: "Varış fotoğrafı",
    description: "Olay yerine vardığında aracın genel durumu",
    activeStages: ["arrived", "loading"],
  },
  {
    kind: "tech_loading",
    label: "Yükleme fotoğrafı",
    description: "Araç platforma alınırken kanıt",
    activeStages: ["loading", "in_transit"],
  },
  {
    kind: "tech_delivery",
    label: "Teslim fotoğrafı",
    description: "Araç varış noktasında, teslim anı",
    activeStages: ["in_transit", "delivered"],
  },
];

const ACTIVE_BROADCAST_STAGES: TowDispatchStage[] = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "loading",
  "in_transit",
];

/**
 * Live tow active job screen — P0-5 iter 2 (2026-04-23).
 *
 * Canonical kaynaklar:
 * - GET /tow/cases/{id} (snapshot, 5 sn polling)
 * - GET /tow/cases/{id}/tracking (ETA + location, 5 sn polling)
 * - POST /tow/cases/{id}/otp/issue (teknisyen arrival/delivery SMS)
 * - POST /tow/cases/{id}/otp/verify (customer recipient'ten gelen kod)
 * - POST /tow/cases/{id}/evidence?kind=... (evidence register)
 *
 * Stage transitions teknisyen aksiyonlarıyla backend'e gider. Backend OTP,
 * evidence ve valid transition gate'lerini canonical olarak tutar.
 *
 * Legacy TowActiveJobScreen (store-backed 750 satır) preview/V1.1 için
 * feature/tow/screens altında kalıyor.
 */
export function TowActiveJobScreenLive() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";

  const snapshotQuery = useTowCaseSnapshotTech(caseId);
  const trackingQuery = useTowTrackingTech(
    caseId,
    snapshotQuery.data
      ? !["delivered", "cancelled"].includes(snapshotQuery.data.stage)
      : false,
  );

  // Location broadcaster — accepted..in_transit arası GPS ping BE'ye.
  useTechTowBroadcaster({
    caseId: caseId || null,
    stage: snapshotQuery.data?.stage ?? null,
  });

  if (snapshotQuery.isLoading) {
    return (
      <Screen
        backgroundClassName="bg-app-bg"
        className="flex-1 items-center justify-center gap-3"
      >
        <ActivityIndicator color="#83a7ff" />
        <Text tone="muted" variant="caption">
          Aktif iş yükleniyor…
        </Text>
      </Screen>
    );
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 gap-4 px-5">
        <View className="flex-row items-center gap-3 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <Text variant="h3" tone="inverse">
            İş yüklenemedi
          </Text>
        </View>
        <Text variant="caption" tone="muted" className="text-center">
          Bağlantını kontrol edip tekrar dene.
        </Text>
        <Button
          label="Tekrar dene"
          variant="outline"
          onPress={() => snapshotQuery.refetch()}
        />
      </Screen>
    );
  }

  const snapshot = snapshotQuery.data;
  const tracking = trackingQuery.data;
  const isTerminal =
    snapshot.stage === "delivered" || snapshot.stage === "cancelled";
  const isActive = ACTIVE_BROADCAST_STAGES.includes(snapshot.stage);

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.back()} variant="close" />
          <View className="flex-1 gap-0.5">
            <Text variant="eyebrow" tone="subtle">
              {snapshot.mode === "immediate" ? "Hemen çekici" : "Randevulu"}
            </Text>
            <Text variant="h2" tone="inverse">
              {STAGE_LABELS[snapshot.stage]}
            </Text>
          </View>
          <StatusChip
            label={STAGE_LABELS[snapshot.stage]}
            tone={isTerminal ? "neutral" : "accent"}
          />
        </View>

        <View className="mt-4 gap-4 px-5">
          {/* Pickup + dropoff */}
          <View className="gap-2.5 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
            <View className="flex-row items-start gap-2.5">
              <Icon icon={MapPin} size={14} color="#2dd28d" />
              <View className="flex-1">
                <Text variant="eyebrow" tone="subtle" className="text-[10px]">
                  Alım
                </Text>
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {snapshot.pickup_label ?? "—"}
                </Text>
              </View>
            </View>
            {snapshot.dropoff_label ? (
              <View className="flex-row items-start gap-2.5">
                <Icon icon={Truck} size={14} color="#ff7e7e" />
                <View className="flex-1">
                  <Text variant="eyebrow" tone="subtle" className="text-[10px]">
                    Varış
                  </Text>
                  <Text variant="label" tone="inverse" className="text-[13px]">
                    {snapshot.dropoff_label}
                  </Text>
                </View>
              </View>
            ) : null}
            {tracking?.eta_minutes !== null &&
            tracking?.eta_minutes !== undefined &&
            tracking.eta_minutes > 0 ? (
              <View className="flex-row items-center gap-2 rounded-[12px] border border-brand-500/30 bg-brand-500/10 px-3 py-2">
                <Icon icon={MapPin} size={12} color="#0ea5e9" />
                <Text variant="caption" tone="accent" className="text-[12px]">
                  ETA {tracking.eta_minutes} dk
                </Text>
              </View>
            ) : null}
          </View>

          {/* OTP panels (arrival + delivery) */}
          {isActive ? (
            <OtpPanel
              caseId={caseId}
              purpose="arrival"
              activeStages={["arrived"]}
              stage={snapshot.stage}
            />
          ) : null}
          {isActive ? (
            <OtpPanel
              caseId={caseId}
              purpose="delivery"
              activeStages={["in_transit"]}
              stage={snapshot.stage}
            />
          ) : null}

          {/* Evidence */}
          {isActive ? (
            <View className="gap-2">
              <Text variant="eyebrow" tone="subtle">
                Kanıt kaydı
              </Text>
              {EVIDENCE_STEPS.filter((step) =>
                step.activeStages.includes(snapshot.stage),
              ).map((step) => (
                <EvidenceRow
                  key={step.kind}
                  caseId={caseId}
                  step={step}
                />
              ))}
            </View>
          ) : null}

          {/* Fare */}
          {snapshot.fare_quote ? (
            <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
              <Text variant="eyebrow" tone="subtle">
                Ücret
              </Text>
              <Text variant="h3" tone="inverse">
                Cap {snapshot.fare_quote.cap_amount}{" "}
                {snapshot.fare_quote.currency}
              </Text>
              {snapshot.final_amount ? (
                <Text variant="caption" tone="success" className="text-[12px]">
                  Nihai: {snapshot.final_amount}{" "}
                  {snapshot.fare_quote.currency}
                </Text>
              ) : null}
            </View>
          ) : null}

          {isTerminal ? (
            <TerminalSummary snapshot={snapshot} />
          ) : null}
        </View>
      </ScrollView>

      <StageActionFooter
        caseId={caseId}
        snapshot={snapshot}
        onHome={() => router.replace("/(tabs)")}
      />
    </Screen>
  );
}

const NEXT_STAGE_ACTIONS: Partial<
  Record<
    TowDispatchStage,
    { stage: TowStageTransitionInput["stage"]; label: string; hint: string }
  >
> = {
  accepted: {
    stage: "en_route",
    label: "Yola çıktım",
    hint: "Konum paylaşımı başlar; müşteri çekicinin yolda olduğunu görür.",
  },
  en_route: {
    stage: "arrived",
    label: "Konuma vardım",
    hint: "Varış kodu ve varış fotoğrafı sonraki adımı açar.",
  },
  nearby: {
    stage: "arrived",
    label: "Konuma vardım",
    hint: "Varış kodu ve varış fotoğrafı sonraki adımı açar.",
  },
  arrived: {
    stage: "loading",
    label: "Yüklemeye başla",
    hint: "Varış kodu ve fotoğraf olmadan backend izin vermez.",
  },
  loading: {
    stage: "in_transit",
    label: "Teslim yoluna çıktım",
    hint: "Yükleme fotoğrafı sonrası araç varış noktasına taşınır.",
  },
  in_transit: {
    stage: "delivered",
    label: "Teslim ettim",
    hint: "Teslim kodu ve teslim fotoğrafı sonrası ödeme kapatılır.",
  },
};

function StageActionFooter({
  caseId,
  snapshot,
  onHome,
}: {
  caseId: string;
  snapshot: TowCaseSnapshot;
  onHome: () => void;
}) {
  const transition = useTransitionTowStage(caseId);
  const action = NEXT_STAGE_ACTIONS[snapshot.stage];
  const isTerminal =
    snapshot.stage === "delivered" || snapshot.stage === "cancelled";

  if (isTerminal) {
    return (
      <View className="absolute inset-x-0 bottom-0 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
        <Button label="Ana sayfaya dön" size="lg" fullWidth onPress={onHome} />
      </View>
    );
  }

  if (!action) return null;

  return (
    <View className="absolute inset-x-0 bottom-0 gap-2 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
        {action.hint}
      </Text>
      <Button
        label={transition.isPending ? "Güncelleniyor..." : action.label}
        size="lg"
        fullWidth
        disabled={transition.isPending}
        loading={transition.isPending}
        onPress={() => {
          void transition.mutateAsync({ stage: action.stage });
        }}
      />
      {transition.isError ? (
        <Text variant="caption" tone="critical" className="text-[12px]">
          Bu adım için kod veya fotoğraf eksik olabilir.
        </Text>
      ) : null}
    </View>
  );
}

function OtpPanel({
  caseId,
  purpose,
  activeStages,
  stage,
}: {
  caseId: string;
  purpose: "arrival" | "delivery";
  activeStages: TowDispatchStage[];
  stage: TowDispatchStage;
}) {
  const issueMutation = useIssueTowOtp(caseId);
  const verifyMutation = useVerifyTowOtpTech(caseId);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!activeStages.includes(stage)) return null;
  const label = purpose === "arrival" ? "Tanışma kodu" : "Teslim kodu";
  const description =
    purpose === "arrival"
      ? "Müşteriye SMS ile tanışma kodu gönder; müşteri söyleyince aşağıya yaz."
      : "Teslim noktasında müşteriye delivery kodu gönder; teslim anı için doğrula.";

  const handleIssue = async () => {
    try {
      await issueMutation.mutateAsync({
        purpose,
        recipient: purpose === "arrival" ? "customer" : "delivery_person",
      });
      setLocalError(null);
    } catch {
      setLocalError("Kod gönderilemedi.");
    }
  };

  const handleVerify = async () => {
    if (code.trim().length < 4) {
      setLocalError("4 haneli kodu gir.");
      return;
    }
    try {
      await verifyMutation.mutateAsync({ purpose, code: code.trim() });
      setVerified(true);
      setCode("");
      setLocalError(null);
    } catch {
      setLocalError("Kod hatalı veya süresi dolmuş.");
    }
  };

  if (verified) {
    return (
      <View className="flex-row items-center gap-3 rounded-[22px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
        <Icon icon={CheckCircle2} size={18} color="#2dd28d" />
        <Text variant="label" tone="success">
          {label} doğrulandı
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[22px] border border-app-warning/30 bg-app-warning-soft px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={KeyRound} size={16} color="#f5b33f" />
        <Text variant="eyebrow" tone="warning">
          {label}
        </Text>
      </View>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text text-[13px] leading-[18px]"
      >
        {description}
      </Text>
      <Button
        label={issueMutation.isPending ? "Kod gönderiliyor…" : "SMS gönder"}
        variant="outline"
        size="md"
        onPress={handleIssue}
        loading={issueMutation.isPending}
        disabled={issueMutation.isPending}
      />
      <View className="flex-row items-center gap-2">
        <View className="flex-1 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="4 haneli kod"
            placeholderTextColor="#6f7b97"
            keyboardType="number-pad"
            maxLength={4}
            editable={!verifyMutation.isPending}
            className="text-base text-app-text"
          />
        </View>
        <Button
          label="Doğrula"
          size="md"
          onPress={handleVerify}
          loading={verifyMutation.isPending}
          disabled={verifyMutation.isPending}
        />
      </View>
      {localError ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={AlertCircle} size={12} color="#ff7e7e" />
          <Text variant="caption" tone="critical" className="text-[12px]">
            {localError}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EvidenceRow({
  caseId,
  step,
}: {
  caseId: string;
  step: {
    kind: TowEvidenceKind;
    label: string;
    description: string;
  };
}) {
  const register = useRegisterTowEvidence(caseId);
  const media = useServiceMediaUpload();
  const [done, setDone] = useState(false);

  const handleRegister = async () => {
    try {
      const uploaded = await media.pickAndUpload({
        purpose:
          step.kind === "tech_delivery"
            ? "tow_delivery_photo"
            : step.kind === "tech_loading"
              ? "tow_loading_photo"
              : "tow_arrival_photo",
        ownerKind: "service_case",
        ownerRef: caseId,
        selection: "photo",
        fallbackName: `${step.kind}-${Date.now()}.jpg`,
      });
      if (!uploaded) return;
      await register.mutateAsync({
        kind: step.kind,
        media_asset_id: uploaded.asset.id,
      });
      setDone(true);
    } catch {
      // Sessiz — UI'da istemesi ister yine basabilir.
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={done ? undefined : handleRegister}
      disabled={done || register.isPending || media.isUploading}
      className={[
        "flex-row items-center gap-3 rounded-[16px] border px-3.5 py-3",
        done
          ? "border-app-success/40 bg-app-success-soft"
          : "border-app-outline bg-app-surface active:bg-app-surface-2",
      ].join(" ")}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
        <Icon
          icon={done ? CheckCircle2 : Camera}
          size={15}
          color={done ? "#2dd28d" : "#83a7ff"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone={done ? "success" : "inverse"} className="text-[13px]">
          {step.label}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
          numberOfLines={1}
        >
          {done ? "Kayıt tamam" : step.description}
        </Text>
      </View>
      {register.isPending || media.isUploading ? (
        <ActivityIndicator size="small" color="#83a7ff" />
      ) : null}
    </Pressable>
  );
}

function TerminalSummary({ snapshot }: { snapshot: TowCaseSnapshot }) {
  if (snapshot.stage === "cancelled") {
    return (
      <View className="gap-2 rounded-[22px] border border-app-critical/30 bg-app-critical-soft px-4 py-4">
        <Text variant="eyebrow" tone="critical">
          Talep iptal edildi
        </Text>
        {snapshot.cancellation_fee ? (
          <Text variant="caption" tone="muted" className="text-[12px]">
            İptal ücreti: {snapshot.cancellation_fee}
          </Text>
        ) : null}
      </View>
    );
  }
  if (snapshot.stage === "delivered") {
    return (
      <View className="gap-2 rounded-[22px] border border-app-success/40 bg-app-success-soft px-4 py-4">
        <Text variant="eyebrow" tone="success">
          İş tamam
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text text-[12px]">
          Teslim gerçekleşti. Ücret ve payout settlement sonrasında güncellenir.
        </Text>
      </View>
    );
  }
  return null;
}
