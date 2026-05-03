import {
  BackButton,
  BillingStateBadge,
  Button,
  Icon,
  MoneyAmount,
  Screen,
  Surface,
  Text,
  ThreeDSWebView,
  TrustBadge,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import {
  useAbandonPayment,
  useBillingSummary,
  useInitiatePayment,
} from "../api";
import { useThreeDSFlow } from "../hooks";
import type { PaymentInitiateResponse } from "../schemas";

type Phase =
  | { kind: "idle" }
  | { kind: "initiating" }
  | {
      kind: "3ds";
      redirectUrl: string;
      paymentId: string | null;
      attempt: number;
    }
  | { kind: "success"; paymentId: string | null }
  | {
      kind: "failed";
      code:
        | "card_declined"
        | "3ds_timeout"
        | "abandoned"
        | "unknown"
        | "network";
      message: string | null;
    };

const ERROR_META: Record<
  Extract<Phase, { kind: "failed" }>["code"],
  { title: string; hint: string; retryable: boolean }
> = {
  card_declined: {
    title: "Kart reddedildi",
    hint: "Farklı kart ile tekrar dene veya bankanla görüş.",
    retryable: true,
  },
  "3ds_timeout": {
    title: "3D Secure süresi doldu",
    hint: "Tekrar başlat; banka SMS'ini daha hızlı onayla.",
    retryable: true,
  },
  abandoned: {
    title: "Ödeme iptal edildi",
    hint: "Geri geldin; istersen yeniden başlat.",
    retryable: true,
  },
  network: {
    title: "Bağlantı hatası",
    hint: "İnternetini kontrol et ve tekrar dene.",
    retryable: true,
  },
  unknown: {
    title: "Ödeme tamamlanamadı",
    hint: "Yeniden dene; sorun sürerse destek üzerinden yaz.",
    retryable: true,
  },
};

export function PaymentInitiateScreen() {
  const router = useRouter();
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const caseIdSafe = caseId ?? "";

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const initiate = useInitiatePayment(caseIdSafe);
  const abandon = useAbandonPayment(caseIdSafe);
  const summaryQuery = useBillingSummary(caseIdSafe);
  // BE PREAUTH_FAILED auto-detect: bir defalık tetiklenir. Retry kullanıcı
  // tarafında "Farklı kartla tekrar dene" → start()'ı doğrudan çağırır;
  // aksi halde idle ↔ failed döngüsüne girer (BE state retry initiate
  // çağrılana kadar PREAUTH_FAILED'da kalır).
  const autoFailHandledRef = useRef(false);
  useEffect(() => {
    if (autoFailHandledRef.current) return;
    if (phase.kind !== "idle") return;
    if (summaryQuery.data?.billing_state === "preauth_failed") {
      autoFailHandledRef.current = true;
      setPhase({
        kind: "failed",
        code: "card_declined",
        message: "Önceki ödeme denemen sonuçlanmadı. Farklı bir kartla tekrar dene.",
      });
    }
  }, [phase.kind, summaryQuery.data?.billing_state]);

  const start = useCallback(async () => {
    setPhase({ kind: "initiating" });
    try {
      const response: PaymentInitiateResponse = await initiate.mutateAsync();
      setPhase({
        kind: "3ds",
        redirectUrl: response.checkout_url,
        paymentId: null,
        attempt: 1,
      });
    } catch (err) {
      console.warn("payment initiate failed", err);
      setPhase({
        kind: "failed",
        code: "network",
        message: err instanceof Error ? err.message : null,
      });
    }
  }, [initiate]);

  const retry = useCallback(() => {
    void start();
  }, [start]);

  const redirectUrl = phase.kind === "3ds" ? phase.redirectUrl : null;

  const flow = useThreeDSFlow({
    redirectUrl,
    onSuccess: (paymentId) => {
      setPhase({ kind: "success", paymentId });
    },
    onFail: ({ code, message }) => {
      setPhase({ kind: "failed", code, message });
      // F1.6: Webhook gelmeden FE timeout/abandon → BE'ye notify et,
      // billing_state PREAUTH_REQUESTED'da takılmasın. Hata yutulur
      // (BE 409 PREAUTH_HELD ise zaten doğru durum, ekran refetch eder).
      if (code === "3ds_timeout" || code === "abandoned") {
        abandon.mutate();
      }
    },
  });

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-3">
        <BackButton
          onPress={() => {
            if (phase.kind === "3ds") {
              flow.abandon();
            }
            router.back();
          }}
        />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Güvenli ödeme
          </Text>
          <Text variant="h2" tone="inverse">
            Ödemeyi başlat
          </Text>
        </View>
        {phase.kind === "3ds" ? (
          <BillingStateBadge state="preauth_requested" />
        ) : phase.kind === "success" ? (
          <BillingStateBadge state="preauth_held" />
        ) : null}
      </View>

      {phase.kind === "3ds" ? (
        <View className="flex-1 px-5 pb-5">
          <ThreeDSWebView
            source={phase.redirectUrl}
            onShouldAllowRequest={flow.shouldAllowNavigation}
            loading={flow.state.phase === "loading"}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ödemeyi iptal et"
            onPress={() => {
              flow.abandon();
              router.back();
            }}
            className="mt-3 items-center justify-center rounded-[16px] border border-app-outline bg-app-surface px-4 py-2.5 active:bg-app-surface-2"
          >
            <Text variant="label" tone="critical" className="text-[13px]">
              Ödemeyi iptal et
            </Text>
          </Pressable>
        </View>
      ) : phase.kind === "success" ? (
        <SuccessBody
          paymentId={phase.paymentId}
          onDone={() => router.back()}
        />
      ) : phase.kind === "failed" ? (
        <FailedBody
          code={phase.code}
          message={phase.message}
          onRetry={retry}
          onCancel={() => router.back()}
        />
      ) : (
        <IdleBody
          phase={phase}
          onStart={start}
          onCancel={() => router.back()}
        />
      )}
    </Screen>
  );
}

function IdleBody({
  phase,
  onStart,
  onCancel,
}: {
  phase: Phase;
  onStart: () => void;
  onCancel: () => void;
}) {
  const busy = phase.kind === "initiating";
  return (
    <View className="flex-1 gap-4 px-5 pb-5">
      <Surface variant="raised" radius="xl" className="gap-3 px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={Lock} size={16} color="#2dd28d" />
          <Text variant="eyebrow" tone="success">
            SSL + 3D Secure
          </Text>
        </View>
        <Text variant="h3" tone="inverse" className="text-[15px]">
          Kart bilgin bizde değil
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[17px]"
        >
          Ödeme Iyzico'nun güvenli sayfasında alınır. Naro kart numaranı
          asla görmez veya saklamaz. Bankan sana SMS şifresi gönderir.
        </Text>
      </Surface>

      <Surface variant="flat" radius="lg" className="gap-2 px-4 py-4">
        <Text variant="eyebrow" tone="subtle">
          Nasıl ilerler?
        </Text>
        <Row text="Güvenli ödeme sayfası açılır, kart bilginle dolduruyorsun." />
        <Row text="Bankan SMS şifresi gönderir — onayla." />
        <Row text="Tutar kartta tutulur, iş bitince kesilir." />
      </Surface>

      <View className="flex-1" />

      <View className="gap-2">
        <Button
          label={busy ? "Başlatılıyor…" : "Ödemeyi başlat"}
          size="lg"
          fullWidth
          loading={busy}
          disabled={busy}
          onPress={onStart}
        />
        <Button
          label="Vazgeç"
          variant="outline"
          size="md"
          fullWidth
          onPress={onCancel}
          disabled={busy}
        />
      </View>
    </View>
  );
}

function SuccessBody({
  paymentId,
  onDone,
}: {
  paymentId: string | null;
  onDone: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-app-success-soft">
        <Icon icon={CheckCircle2} size={34} color="#2dd28d" />
      </View>
      <View className="items-center gap-1">
        <Text variant="h2" tone="inverse" className="text-center">
          Ödeme başlatıldı
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted text-[12px] leading-[17px]"
        >
          Tutar kartta tutuluyor (pre-auth). İş tamamlanınca otomatik
          tahsil edilecek, fazla tutulan iade olacak.
        </Text>
      </View>
      <TrustBadge label="Pre-auth tutuluyor" tone="info" />
      {paymentId ? (
        <Text variant="caption" tone="subtle" className="text-[10px]">
          Ref: {paymentId.slice(0, 8)}
        </Text>
      ) : null}
      <View className="h-2" />
      <Button label="Vakaya dön" size="lg" onPress={onDone} />
    </View>
  );
}

function FailedBody({
  code,
  message,
  onRetry,
  onCancel,
}: {
  code: Extract<Phase, { kind: "failed" }>["code"];
  message: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const meta = ERROR_META[code];
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-app-critical-soft">
        <Icon icon={AlertCircle} size={32} color="#ff7e7e" />
      </View>
      <View className="items-center gap-1">
        <Text variant="h2" tone="inverse" className="text-center">
          {meta.title}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted text-[12px] leading-[17px]"
        >
          {meta.hint}
        </Text>
        {message ? (
          <Text
            variant="caption"
            tone="subtle"
            className="text-center text-[10px]"
          >
            {message}
          </Text>
        ) : null}
      </View>
      <MoneyAmount amount={null} variant="h3" tone="muted" />
      <View className="gap-2 self-stretch">
        {meta.retryable ? (
          <Button
            label={
              code === "card_declined"
                ? "Farklı kartla tekrar dene"
                : "Tekrar dene"
            }
            size="lg"
            fullWidth
            leftIcon={<Icon icon={RefreshCcw} size={16} color="#ffffff" />}
            onPress={onRetry}
          />
        ) : null}
        <Button label="Geri dön" variant="outline" fullWidth onPress={onCancel} />
      </View>
    </View>
  );
}

function Row({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon icon={ShieldCheck} size={12} color="#83a7ff" />
      <Text
        variant="caption"
        tone="muted"
        className="flex-1 text-app-text-muted text-[12px] leading-[17px]"
      >
        {text}
      </Text>
    </View>
  );
}
