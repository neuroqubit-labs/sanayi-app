import {
  BackButton,
  Button,
  Icon,
  Screen,
  StatusChip,
  Text,
  useNaroTheme,
  withAlphaHex,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  KeyRound,
  MapPin,
  ShieldCheck,
  Star,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { useCaseDetailLive } from "@/features/cases/api";
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

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.replace("/(tabs)" as Href);
        return true;
      },
    );
    return () => subscription.remove();
  }, [router]);

  // BE Faz 2 (2026-04-23) — çekici, accident/breakdown parent'tan doğduysa
  // "şu vakadan geldi" link CTA'sı. Canonical case detail endpoint'inden
  // okunur (tow snapshot parent_case_id expose etmiyor).
  const detailLive = useCaseDetailLive(caseId);
  const parentCaseId = detailLive.data?.parent_case_id ?? null;

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
          <BackButton onPress={() => router.replace("/(tabs)" as Href)} variant="close" />
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
  const needsPayment =
    snapshot.stage === "payment_required" ||
    snapshot.stage === "preauth_failed" ||
    snapshot.stage === "preauth_stale";
  const waitsForPaymentWindow =
    snapshot.stage === "scheduled_waiting" &&
    snapshot.payment?.next_action === "wait_until_payment_window";
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
        contentContainerStyle={{ paddingBottom: isTerminal ? 150 : 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <BackButton onPress={() => router.replace("/(tabs)" as Href)} variant="close" />
          <View className="flex-1" />
          {!isSearching ? (
            <StatusChip
              label={presentation.eyebrow}
              tone={presentation.tone}
            />
          ) : null}
        </View>

        {!isSearching ? (
          <View className="px-5 pt-4">
            <Text variant="h2" tone="inverse" numberOfLines={1}>
              {presentation.title}
            </Text>
          </View>
        ) : null}

        {parentCaseId ? (
          <View className="mt-3 px-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bu çekicinin bağlı olduğu vakayı aç"
              onPress={() => router.push(`/vaka/${parentCaseId}` as Href)}
              className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/40 bg-brand-500/10 px-4 py-3.5 active:opacity-90"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
                <Icon icon={FileText} size={18} color="#0ea5e9" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="eyebrow" tone="subtle">
                  Bu çekici şu vakadan geldi
                </Text>
                <Text variant="label" tone="inverse" className="text-[14px]">
                  {`Vaka #${parentCaseId.slice(0, 8)}`}
                </Text>
              </View>
              <Icon icon={ChevronRight} size={16} color="#83a7ff" />
            </Pressable>
          </View>
        ) : null}

        {!isTerminal ? (
          <View className="mt-3 px-5">
            <TowMapCanvas
              stage={snapshot.stage}
              pickup={snapshot.pickup_lat_lng}
              dropoff={snapshot.dropoff_lat_lng}
              current={tracking?.last_location ?? null}
              etaMinutes={tracking?.eta_minutes ?? null}
            />
          </View>
        ) : null}

        <View className="mt-3 gap-3 px-5">
          {needsPayment ? (
            <PaymentRequiredCard
              label={snapshot.payment?.amount_label ?? null}
              retry={snapshot.stage !== "payment_required"}
              onPress={() =>
                router.push(`/(modal)/cekici-odeme/${snapshot.id}` as Href)
              }
            />
          ) : null}

          {waitsForPaymentWindow ? (
            <ScheduledPaymentWindowCard
              opensAt={snapshot.payment_window_opens_at ?? null}
              amountLabel={snapshot.payment?.amount_label ?? null}
            />
          ) : null}

          {isSearching ? (
            <SearchingTowCard
              noImmediateCandidate={snapshot.stage === "timeout_converted_to_pool"}
              onAccidentPress={() =>
                router.push("/(modal)/talep/accident" as Href)
              }
            />
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

          {!isTerminal && !needsPayment ? (
            <CancelTowButton
              pending={cancel.isPending}
              onPress={handleCancel}
            />
          ) : null}
        </View>
      </ScrollView>

      {isTerminal ? (
        <View className="absolute inset-x-0 bottom-0 border-t border-app-outline bg-app-bg px-5 pb-8 pt-4">
          <Button
            label="Ana sayfaya dön"
            size="lg"
            fullWidth
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function ScheduledPaymentWindowCard({
  opensAt,
  amountLabel,
}: {
  opensAt: string | null;
  amountLabel: string | null;
}) {
  const label = opensAt
    ? new Date(opensAt).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Randevuya yakın";
  return (
    <View className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-app-info-soft">
          <Icon icon={ShieldCheck} size={17} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[14px]">
            Ödeme zamanı yaklaşınca açılacak
          </Text>
          <Text variant="caption" tone="muted" className="text-[12px] leading-[17px]">
            {label} civarında bildirim göndeririz. {amountLabel ?? "Tavan ücret"} bu
            adımda yeniden doğrulanır.
          </Text>
        </View>
      </View>
    </View>
  );
}

function canShowOtp(stage: TowDispatchStage): boolean {
  return (
    stage === "arrived" ||
    stage === "loading" ||
    stage === "in_transit"
  );
}

function SearchingTowCard({
  noImmediateCandidate,
  onAccidentPress,
}: {
  noImmediateCandidate: boolean;
  onAccidentPress: () => void;
}) {
  return (
    <View className="gap-3 rounded-[24px] border border-brand-500/25 bg-brand-500/10 px-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
          <ActivityIndicator size="small" color="#83a7ff" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[14px]">
            {noImmediateCandidate ? "Talep açık" : "Operatör bekleniyor"}
          </Text>
        </View>
      </View>
      <Button
        label="Beklerken hasar bildir"
        variant="outline"
        size="md"
        fullWidth
        onPress={onAccidentPress}
      />
    </View>
  );
}

function PaymentRequiredCard({
  label,
  retry,
  onPress,
}: {
  label: string | null;
  retry: boolean;
  onPress: () => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <View className="gap-3 rounded-[24px] border border-brand-500/25 bg-brand-500/10 px-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={CreditCard} size={18} color={colors.info} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[14px]">
            {retry ? "Ödeme tekrar gerekiyor" : "Ödeme adımı bekliyor"}
          </Text>
          {label ? (
            <Text variant="caption" tone="muted" className="text-[12px]">
              {label}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        label={retry ? "Ödemeyi tekrar dene" : "Güvenli ödeme ile devam et"}
        size="md"
        fullWidth
        onPress={onPress}
      />
    </View>
  );
}

function CancelTowButton({
  pending,
  onPress,
}: {
  pending: boolean;
  onPress: () => void;
}) {
  const { colors } = useNaroTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={pending}
      className="min-h-12 flex-row items-center justify-center gap-2 rounded-[18px] border bg-transparent px-4 py-3 active:bg-app-critical-soft"
      style={{ borderColor: withAlphaHex(colors.critical, 0.24) }}
    >
      <Icon icon={X} size={14} color={colors.critical} />
      <Text variant="label" tone="critical">
        {pending ? "İptal ediliyor..." : "Talebi iptal et"}
      </Text>
    </Pressable>
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
  const hasPaymentGuarantee = snapshot.settlement_status !== "none";
  const isTerminal =
    snapshot.stage === "delivered" || snapshot.stage === "cancelled";

  if (!cap && !final && !hasPaymentGuarantee) return null;

  if (!isTerminal && final === null) {
    return hasPaymentGuarantee ? (
      <View className="flex-row items-center gap-2 rounded-[18px] border border-app-success/30 bg-app-success-soft px-4 py-3">
        <Icon icon={ShieldCheck} size={15} color="#2dd28d" />
        <Text variant="label" tone="success" className="text-[13px]">
          Ön provizyon alındı
        </Text>
      </View>
    ) : null;
  }

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
        numberOfLines={2}
      >
        Cap tutarı pre-auth olarak tutulur; iş bitiminde gerçek tutar kesilir,
        fark otomatik iade edilir.
      </Text>
      {hasPaymentGuarantee ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={ShieldCheck} size={13} color="#2dd28d" />
          <Text variant="caption" tone="success" className="text-[11px]">
            Ön provizyon alındı
          </Text>
        </View>
      ) : null}
    </View>
  );
}
