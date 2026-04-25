import { ApiError } from "@naro/mobile-core";
import {
  BackButton,
  Button,
  Icon,
  Screen,
  Text,
  ThreeDSWebView,
  TrustBadge,
  useNaroTheme,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, CreditCard, Lock, RefreshCcw, ShieldCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { useThreeDSFlow } from "@/features/billing/hooks";

import {
  useAbandonTowPayment,
  useInitiateTowPayment,
  useTowCaseSnapshot,
} from "../api";

type Phase =
  | { kind: "idle" }
  | { kind: "initiating" }
  | { kind: "3ds"; checkoutUrl: string }
  | { kind: "success" }
  | { kind: "failed"; message: string | null };

function formatAmount(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "En fazla tutar hazırlanıyor";
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw);
  if (Number.isNaN(value)) return "En fazla tutar hazırlanıyor";
  return `En fazla ₺${Math.round(value).toLocaleString("tr-TR")}`;
}

function towPaymentErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | undefined;
    const detail = body?.detail;
    const type =
      detail && typeof detail === "object"
        ? (detail as { type?: unknown }).type
        : null;
    if (type === "tow_route_missing") {
      return "Alım ve teslim noktası tamamlanmadan ödeme başlatılamaz.";
    }
    if (type === "payment_not_allowed") {
      return "Bu talep için ödeme adımı şu anda açık değil.";
    }
    if (type === "payment_subject_not_found") {
      return "Çekici talebi bulunamadı. Ana sayfadan tekrar deneyebilirsin.";
    }
    if (err.status === 409) {
      return "Bu talep için açık bir ödeme adımı var. Birazdan tekrar deneyebilirsin.";
    }
    if (err.status === 422) {
      return "Ödeme için gerekli bilgiler eksik görünüyor.";
    }
  }
  if (err instanceof Error && err.message !== "API error 402") {
    return err.message.startsWith("API error")
      ? "Ödeme başlatılamadı. Bağlantını kontrol edip tekrar dene."
      : err.message;
  }
  return "Ödeme başlatılamadı. Bağlantını kontrol edip tekrar dene.";
}

export function TowPaymentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";
  const { colors } = useNaroTheme();

  const snapshotQuery = useTowCaseSnapshot(caseId);
  const initiate = useInitiateTowPayment(caseId);
  const abandonPayment = useAbandonTowPayment(caseId);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const goTracking = useCallback(() => {
    router.replace(`/cekici/${caseId}` as Href);
  }, [caseId, router]);

  const start = useCallback(async () => {
    setPhase({ kind: "initiating" });
    try {
      const response = await initiate.mutateAsync();
      if (response.checkout_url.startsWith("mock://")) {
        setPhase({ kind: "success" });
        goTracking();
        return;
      }
      setPhase({ kind: "3ds", checkoutUrl: response.checkout_url });
    } catch (err) {
      setPhase({
        kind: "failed",
        message: towPaymentErrorMessage(err),
      });
    }
  }, [goTracking, initiate]);

  const flow = useThreeDSFlow({
    redirectUrl: phase.kind === "3ds" ? phase.checkoutUrl : null,
    onSuccess: () => {
      setPhase({ kind: "success" });
      goTracking();
    },
    onFail: ({ code, message }) => {
      if (code === "abandoned") {
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "failed", message });
    },
  });

  const closePaymentStep = useCallback(() => {
    void abandonPayment.mutateAsync().finally(() => {
      flow.abandon();
      void snapshotQuery.refetch();
    });
  }, [abandonPayment, flow, snapshotQuery]);

  const amountLabel =
    snapshotQuery.data?.payment?.amount_label ??
    formatAmount(snapshotQuery.data?.fare_quote?.cap_amount);

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-3">
        <BackButton
          variant="close"
          onPress={() => {
            if (phase.kind === "3ds") {
              closePaymentStep();
              return;
            }
            router.back();
          }}
        />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Çekici çağır
          </Text>
          <Text variant="h2" tone="inverse">
            Güvenli ödeme
          </Text>
        </View>
      </View>

      {phase.kind === "3ds" ? (
        <View className="flex-1 px-5 pb-5">
          <ThreeDSWebView
            source={phase.checkoutUrl}
            onShouldAllowRequest={flow.shouldAllowNavigation}
            loading={flow.state.phase === "loading"}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ödeme adımını iptal et"
            onPress={() => {
              closePaymentStep();
            }}
            className="mt-3 min-h-11 items-center justify-center rounded-[16px] border border-app-outline bg-transparent px-4 py-2.5 active:bg-app-surface-2"
          >
            <Text variant="label" tone="critical" className="text-[13px]">
              Ödeme adımını kapat
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1 gap-4 px-5 pb-6">
          <View className="rounded-[28px] border border-app-outline bg-app-surface px-5 py-5">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-500/15">
                <Icon icon={CreditCard} size={22} color={colors.info} />
              </View>
              <View className="flex-1">
                <Text variant="eyebrow" tone="subtle">
                  Ön provizyon
                </Text>
                <Text variant="h2" tone="inverse" numberOfLines={1}>
                  {amountLabel}
                </Text>
              </View>
            </View>
            <View className="mt-4 gap-2">
              <PaymentLine text="Karttan sadece üst sınır kadar provizyon alınır." />
              <PaymentLine text="Teslimde gerçek tutar kesilir; fark otomatik serbest kalır." />
              <PaymentLine text="Kart bilgileri Naro'ya değil, ödeme sağlayıcıya gider." />
            </View>
          </View>

          {phase.kind === "failed" ? (
            <View className="rounded-[20px] border border-app-critical/30 bg-app-critical-soft px-4 py-3">
              <Text variant="label" tone="critical">
                Ödeme başlatılamadı
              </Text>
              {phase.message ? (
                <Text variant="caption" tone="muted" className="mt-1 text-[12px]">
                  {phase.message}
                </Text>
              ) : null}
            </View>
          ) : null}

          {snapshotQuery.isLoading || phase.kind === "success" ? (
            <View className="flex-row items-center gap-2">
              {phase.kind === "success" ? (
                <Icon icon={CheckCircle2} size={16} color={colors.success} />
              ) : (
                <ActivityIndicator size="small" color={colors.info} />
              )}
              <Text variant="caption" tone="muted">
                {phase.kind === "success"
                  ? "Ödeme alındı, çekici aranıyor."
                  : "Tutar güvenli şekilde hazırlanıyor."}
              </Text>
            </View>
          ) : null}

          <View className="flex-1" />

          <View className="gap-2">
            <TrustBadge label="SSL + 3D Secure" tone="info" />
            <Button
              label={
                phase.kind === "initiating"
                  ? "Güvenli ödeme açılıyor..."
                  : "Güvenli ödeme ile devam et"
              }
              size="lg"
              fullWidth
              loading={phase.kind === "initiating"}
              disabled={phase.kind === "initiating" || snapshotQuery.isLoading}
              leftIcon={<Icon icon={Lock} size={16} color={colors.surface} />}
              onPress={start}
            />
            {phase.kind === "failed" ? (
              <Button
                label="Tekrar dene"
                variant="outline"
                fullWidth
                leftIcon={<Icon icon={RefreshCcw} size={15} color={colors.info} />}
                onPress={() => setPhase({ kind: "idle" })}
              />
            ) : null}
          </View>
        </View>
      )}
    </Screen>
  );
}

function PaymentLine({ text }: { text: string }) {
  const { colors } = useNaroTheme();
  return (
    <View className="flex-row items-start gap-2">
      <Icon icon={ShieldCheck} size={13} color={colors.success} />
      <Text variant="caption" tone="muted" className="flex-1 text-[12px] leading-[17px]">
        {text}
      </Text>
    </View>
  );
}
