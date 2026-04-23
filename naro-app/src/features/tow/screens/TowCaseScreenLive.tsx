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
  KeyRound,
  MapPin,
  Star,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { useTechnicianPublicView } from "@/features/ustalar/api";

import {
  useCancelTowCase,
  useSubmitTowRating,
  useTowCaseSnapshot,
  useTowTracking,
  useVerifyTowOtp,
} from "../api";
import { TowMapCanvas } from "../components/TowMapCanvas";
import { getTowStagePresentation } from "../presentation";
import type { TowCaseSnapshot, TowDispatchStage } from "../schemas";

const SEARCHING_STAGES: TowDispatchStage[] = [
  "searching",
  "timeout_converted_to_pool",
];

function parseDecimal(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

/**
 * Live tow case screen — P0-4 iter 2 (2026-04-23).
 *
 * Canonical kaynaklar:
 * - GET /tow/cases/{id} (snapshot)
 * - GET /tow/cases/{id}/tracking (location + eta, 5s polling fallback)
 * - POST /tow/cases/{id}/cancel (cancel reason)
 * - POST /tow/cases/{id}/otp/verify (arrival/delivery)
 * - POST /tow/cases/{id}/rating (final)
 *
 * Scope dışı (V2):
 * - Scheduled tow bid list (BE stub)
 * - Live WS location overlay (polling yeterli pilot için)
 * - Evidence yükleme (teknisyen tarafında)
 */
export function TowCaseScreenLive() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";

  const snapshotQuery = useTowCaseSnapshot(caseId);
  const trackingQuery = useTowTracking(
    caseId,
    snapshotQuery.data
      ? !["delivered", "cancelled"].includes(snapshotQuery.data.stage)
      : false,
  );

  const cancel = useCancelTowCase(caseId);
  const verifyOtp = useVerifyTowOtp(caseId);
  const submitRating = useSubmitTowRating(caseId);

  if (snapshotQuery.isLoading) {
    return (
      <Screen
        backgroundClassName="bg-app-bg"
        className="flex-1 items-center justify-center gap-3"
      >
        <ActivityIndicator color="#83a7ff" />
        <Text tone="muted" variant="caption">
          Çekici talebi yükleniyor…
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
            Talep yüklenemedi
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
  const presentation = getTowStagePresentation(snapshot.stage);
  const isSearching = SEARCHING_STAGES.includes(snapshot.stage);
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
            void cancel.mutateAsync({ reason_code: "customer_cancel" });
          },
        },
      ],
    );
  };

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
              {snapshot.mode === "immediate" ? "Hemen çekici" : "Randevulu çekici"}
              {" · "}
              {presentation.eyebrow}
            </Text>
            <Text variant="h2" tone="inverse">
              {presentation.title}
            </Text>
          </View>
          <StatusChip
            label={presentation.eyebrow}
            tone={presentation.tone}
          />
        </View>

        <View className="px-5 pt-3">
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[13px] leading-[18px]"
          >
            {presentation.description}
          </Text>
        </View>

        {!isTerminal ? (
          <View className="mt-4 px-5">
            <TowMapCanvas
              stage={snapshot.stage}
              pickup={snapshot.pickup_lat_lng}
              dropoff={snapshot.dropoff_lat_lng}
              current={tracking?.last_location ?? null}
              etaMinutes={tracking?.eta_minutes ?? null}
            />
          </View>
        ) : null}

        <View className="mt-4 gap-4 px-5">
          {isSearching ? (
            <View className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface-2 px-4 py-3.5">
              <ActivityIndicator size="small" color="#83a7ff" />
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse" className="text-[13px]">
                  Çekici aranıyor
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[11px]"
                >
                  Bölgendeki uygun çekicilere sırayla bildirim gidiyor.
                </Text>
              </View>
            </View>
          ) : null}

          {snapshot.assigned_technician_id ? (
            <AssignedTechnicianCard
              technicianId={snapshot.assigned_technician_id}
              etaMinutes={tracking?.eta_minutes ?? null}
            />
          ) : null}

          {canShowOtp(snapshot.stage) ? (
            <OtpVerifyPanel
              purpose={otpPurposeForStage(snapshot.stage)}
              onSubmit={(code) =>
                verifyOtp.mutateAsync({
                  purpose: otpPurposeForStage(snapshot.stage),
                  code,
                })
              }
              isPending={verifyOtp.isPending}
              isError={verifyOtp.isError}
            />
          ) : null}

          {snapshot.stage === "delivered" ? (
            <RatingPanel
              onSubmit={(rating, note) =>
                submitRating.mutateAsync({
                  rating,
                  review_note: note || null,
                })
              }
              submitted={submitRating.isSuccess}
              isPending={submitRating.isPending}
            />
          ) : null}

          {snapshot.stage === "cancelled" ? (
            <CancelledSummary
              cancellationFee={parseDecimal(snapshot.cancellation_fee)}
            />
          ) : null}

          <FareSummaryCard snapshot={snapshot} />
        </View>
      </ScrollView>

      {!isTerminal ? (
        <View className="absolute inset-x-0 bottom-0 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
          <Pressable
            accessibilityRole="button"
            onPress={handleCancel}
            disabled={cancel.isPending}
            className="flex-row items-center justify-center gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
          >
            <Icon icon={X} size={14} color="#ff6b6b" />
            <Text variant="label" tone="critical">
              {cancel.isPending ? "İptal ediliyor…" : "Talebi iptal et"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="absolute inset-x-0 bottom-0 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
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

function canShowOtp(stage: TowDispatchStage): boolean {
  return (
    stage === "arrived" ||
    stage === "loading" ||
    stage === "in_transit"
  );
}

function otpPurposeForStage(
  stage: TowDispatchStage,
): "arrival" | "delivery" {
  return stage === "in_transit" ? "delivery" : "arrival";
}

function AssignedTechnicianCard({
  technicianId,
  etaMinutes,
}: {
  technicianId: string;
  etaMinutes: number | null;
}) {
  const { data: tech } = useTechnicianPublicView(technicianId);
  return (
    <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={MapPin} size={13} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle">
          Atanan operatör
        </Text>
        {etaMinutes !== null && etaMinutes > 0 ? (
          <View className="ml-auto">
            <StatusChip label={`${etaMinutes} dk kaldı`} tone="accent" />
          </View>
        ) : null}
      </View>
      <Text variant="label" tone="inverse" className="text-[14px]">
        {tech?.display_name ?? "Bilgi yükleniyor…"}
      </Text>
      {tech?.tagline ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          {tech.tagline}
        </Text>
      ) : null}
    </View>
  );
}

function OtpVerifyPanel({
  purpose,
  onSubmit,
  isPending,
  isError,
}: {
  purpose: "arrival" | "delivery";
  onSubmit: (code: string) => Promise<unknown>;
  isPending: boolean;
  isError: boolean;
}) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const purposeLabel = purpose === "arrival" ? "Tanışma kodu" : "Teslim kodu";
  const description =
    purpose === "arrival"
      ? "Operatör aracının yanına ulaşınca SMS ile gelen 4 haneli kodu buraya yaz."
      : "Araç teslim edildiğinde SMS ile gelen teslim kodunu buraya yaz.";

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (trimmed.length < 4) {
      setLocalError("4 haneli kodu gir.");
      return;
    }
    try {
      await onSubmit(trimmed);
      setLocalError(null);
      setValue("");
      setVerified(true);
    } catch {
      setLocalError("Kod hatalı veya süresi dolmuş. Tekrar kontrol et.");
    }
  };

  if (verified) {
    return (
      <View className="flex-row items-center gap-3 rounded-[22px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
        <Icon icon={CheckCircle2} size={18} color="#2dd28d" />
        <Text variant="label" tone="success">
          {purposeLabel} doğrulandı
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[22px] border border-app-warning/30 bg-app-warning-soft px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={KeyRound} size={16} color="#f5b33f" />
        <Text variant="eyebrow" tone="warning">
          {purposeLabel}
        </Text>
      </View>
      <Text variant="caption" tone="muted" className="text-app-text text-[13px] leading-[18px]">
        {description}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="4 haneli kod"
            placeholderTextColor="#6f7b97"
            keyboardType="number-pad"
            maxLength={4}
            editable={!isPending}
            className="text-base text-app-text"
          />
        </View>
        <Button
          label="Onayla"
          size="md"
          onPress={handleSubmit}
          loading={isPending}
          disabled={isPending}
        />
      </View>
      {localError || isError ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={AlertCircle} size={12} color="#ff7e7e" />
          <Text variant="caption" tone="critical" className="text-[12px]">
            {localError ?? "Doğrulama başarısız. Tekrar dene."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RatingPanel({
  onSubmit,
  submitted,
  isPending,
}: {
  onSubmit: (rating: number, note: string) => Promise<unknown>;
  submitted: boolean;
  isPending: boolean;
}) {
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState("");

  if (submitted) {
    return (
      <View className="flex-row items-center gap-3 rounded-[22px] border border-app-success/40 bg-app-success-soft px-4 py-3.5">
        <Icon icon={CheckCircle2} size={18} color="#2dd28d" />
        <Text variant="label" tone="success">
          Puanın kaydedildi. Teşekkürler.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <Text variant="eyebrow" tone="subtle">
        Deneyimini puanla
      </Text>
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} yıldız`}
            onPress={() => setRating(n)}
            className={`h-10 w-10 items-center justify-center rounded-full border ${
              rating >= n
                ? "border-app-warning bg-app-warning/20"
                : "border-app-outline bg-app-surface-2"
            }`}
          >
            <Icon
              icon={Star}
              size={18}
              color={rating >= n ? "#f5b33f" : "#6f7b97"}
              fill={rating >= n ? "#f5b33f" : "transparent"}
            />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="İsteğe bağlı yorum (opsiyonel)"
        placeholderTextColor="#6f7b97"
        multiline
        className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2 text-sm text-app-text"
        style={{ minHeight: 60 }}
        textAlignVertical="top"
      />
      <Button
        label="Puanı gönder"
        size="md"
        fullWidth
        disabled={rating === 0 || isPending}
        loading={isPending}
        onPress={() => {
          void onSubmit(rating, note.trim());
        }}
      />
    </View>
  );
}

function CancelledSummary({
  cancellationFee,
}: {
  cancellationFee: number | null;
}) {
  return (
    <View className="gap-2 rounded-[22px] border border-app-critical/30 bg-app-critical-soft px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={X} size={14} color="#ff6b6b" />
        <Text variant="eyebrow" tone="critical">
          Talep iptal edildi
        </Text>
      </View>
      {cancellationFee !== null && cancellationFee > 0 ? (
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          İptal ücreti: {formatMoney(cancellationFee)}
        </Text>
      ) : (
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          İptal aşamaya göre ücretsiz.
        </Text>
      )}
    </View>
  );
}

function FareSummaryCard({ snapshot }: { snapshot: TowCaseSnapshot }) {
  const cap = snapshot.fare_quote
    ? parseDecimal(snapshot.fare_quote.cap_amount)
    : null;
  const final = parseDecimal(snapshot.final_amount);

  if (!cap && !final) return null;

  return (
    <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <Text variant="eyebrow" tone="subtle">
        Ücret özeti
      </Text>
      {cap !== null ? (
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted" className="text-[12px]">
            Cap (üst sınır)
          </Text>
          <Text variant="label" tone="inverse" className="text-[13px]">
            {formatMoney(cap)}
          </Text>
        </View>
      ) : null}
      {final !== null ? (
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted" className="text-[12px]">
            Nihai
          </Text>
          <Text variant="label" tone="success" className="text-[13px]">
            {formatMoney(final)}
          </Text>
        </View>
      ) : null}
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[11px] leading-[15px]"
      >
        Cap tutarı pre-auth olarak tutulur; iş bitiminde gerçek tutar kesilir,
        fark otomatik iade edilir.
      </Text>
    </View>
  );
}

