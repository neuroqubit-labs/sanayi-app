import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  ThreeDSCallbackParamsSchema,
  type CancellationFeeEstimate,
  type ThreeDSCallbackParams,
} from "./schemas";

/**
 * 3DS callback URL parser — hem Universal Link (`https://naro.com.tr/
 * billing/3ds-callback?...`) hem custom scheme (`naro://billing/
 * 3ds-callback?...`) desteklenir. Sadece bilinen path + schema ile parse
 * edilir; aksi null döner (silent fail — güvenlik).
 */
export function parseThreeDSCallbackUrl(
  url: string,
): ThreeDSCallbackParams | null {
  const isNative = url.startsWith("naro://billing/3ds-callback");
  const isUniversal = url.startsWith(
    "https://naro.com.tr/billing/3ds-callback",
  );
  if (!isNative && !isUniversal) return null;

  try {
    const parsed = Linking.parse(url);
    const qp = parsed.queryParams ?? {};
    const raw: Record<string, unknown> = {
      payment_id: typeof qp.payment_id === "string" ? qp.payment_id : null,
      status: typeof qp.status === "string" ? qp.status : null,
      error_code: typeof qp.error_code === "string" ? qp.error_code : null,
      error_message:
        typeof qp.error_message === "string" ? qp.error_message : null,
    };
    return ThreeDSCallbackParamsSchema.parse(raw);
  } catch {
    return null;
  }
}

export type ThreeDSFlowState =
  | { phase: "loading" }
  | { phase: "awaiting_callback" }
  | { phase: "success"; paymentId: string }
  | {
      phase: "failed";
      errorCode: string | null;
      errorMessage: string | null;
    }
  | { phase: "timeout" }
  | { phase: "abandoned" };

export type UseThreeDSFlowOptions = {
  /** WebView source URL. Iyzico checkout URL. */
  redirectUrl: string | null;
  /** Callback başarılıysa çağrılır. */
  onSuccess: (paymentId: string) => void;
  /** Callback fail geldiyse veya timeout/abort. */
  onFail: (reason: {
    code: "card_declined" | "3ds_timeout" | "abandoned" | "unknown";
    message: string | null;
  }) => void;
  /** Total flow timeout — brief §4.4 default 60s. */
  timeoutMs?: number;
};

export type UseThreeDSFlowResult = {
  state: ThreeDSFlowState;
  shouldAllowNavigation: (url: string) => boolean;
  abandon: () => void;
  reset: () => void;
};

/**
 * 3DS WebView flow lifecycle hook — komponent tarafında
 * `<ThreeDSWebView>` içinde tüketilir (B2 fazında). Callback URL
 * validation, timeout ve abandon state machine'i burada.
 *
 * BE Faz 1 shipped olmadan gerçek URL akışı yok; hook lifecyle'u
 * smoke test edilebilir (initial state: loading or awaiting).
 */
export function useThreeDSFlow({
  redirectUrl,
  onSuccess,
  onFail,
  timeoutMs = 60_000,
}: UseThreeDSFlowOptions): UseThreeDSFlowResult {
  const [state, setState] = useState<ThreeDSFlowState>(
    redirectUrl ? { phase: "loading" } : { phase: "awaiting_callback" },
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onFailRef = useRef(onFail);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onFailRef.current = onFail;
  }, [onSuccess, onFail]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setState({ phase: "timeout" });
      onFailRef.current({
        code: "3ds_timeout",
        message: "Banka yanıt süresi doldu.",
      });
    }, timeoutMs);
  }, [clearTimer, timeoutMs]);

  // Flow başlatıldığında sayaç açık
  useEffect(() => {
    if (redirectUrl) {
      startTimer();
      setState({ phase: "loading" });
    }
    return () => clearTimer();
  }, [redirectUrl, startTimer, clearTimer]);

  // iOS: SMS okurken background'a düşerse reconnect logic (brief §14.1)
  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      if (next === "active" && state.phase === "awaiting_callback") {
        // Tekrar timer reset — kullanıcı döndü
        startTimer();
      }
    };
    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, [state.phase, startTimer]);

  /**
   * WebView `onShouldStartLoadWithRequest` handler. True → navigation'a
   * izin ver (iyzico içi). False → engelle (callback yakalandı).
   */
  const shouldAllowNavigation = useCallback(
    (url: string): boolean => {
      const callback = parseThreeDSCallbackUrl(url);
      if (!callback) return true; // Iyzico içi navigation — devam
      clearTimer();
      if (callback.status === "success") {
        setState({ phase: "success", paymentId: callback.payment_id });
        onSuccessRef.current(callback.payment_id);
      } else {
        setState({
          phase: "failed",
          errorCode: callback.error_code ?? null,
          errorMessage: callback.error_message ?? null,
        });
        onFailRef.current({
          code: mapErrorCode(callback.error_code),
          message: callback.error_message ?? null,
        });
      }
      return false;
    },
    [clearTimer],
  );

  const abandon = useCallback(() => {
    clearTimer();
    setState({ phase: "abandoned" });
    onFailRef.current({
      code: "abandoned",
      message: "Kullanıcı ödeme akışını iptal etti.",
    });
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState(
      redirectUrl ? { phase: "loading" } : { phase: "awaiting_callback" },
    );
    startTimer();
  }, [clearTimer, redirectUrl, startTimer]);

  return { state, shouldAllowNavigation, abandon, reset };
}

function mapErrorCode(
  raw: string | null | undefined,
): "card_declined" | "3ds_timeout" | "abandoned" | "unknown" {
  if (!raw) return "unknown";
  if (raw.includes("declined") || raw.includes("insufficient_funds")) {
    return "card_declined";
  }
  if (raw.includes("timeout") || raw.includes("expired")) {
    return "3ds_timeout";
  }
  if (raw.includes("abandoned") || raw.includes("cancel")) {
    return "abandoned";
  }
  return "unknown";
}

// ─── Cancellation fee client-side estimate (brief §8.1) ────────────────────

export type CaseBillingStage =
  | "pre_preauth"
  | "preauth_held"
  | "scheduled_before_start"
  | "service_in_progress"
  | "invoice_approval"
  | "completed";

/**
 * Client-side iptal ücreti tahmini (UX feedback için). Sunucu nihai
 * hesaplar — backend `refund_policy.compute_cancellation_fee` otoritedir.
 *
 * V1 basitleştirilmiş (brief §8.1):
 * - pre-auth öncesi: 0 ₺
 * - pre-auth sonrası ama iş başlamadan: 0 ₺ (bakım/hasar/arıza)
 * - iş sürüyor: orantılı (UI için %25 tahmin)
 * - invoice onay sonrası: YOK (refund path)
 *
 * Tow için ayrı matrix (cekici-modu-urun-spec.md §4 K-4) — caller tow
 * kind'ında bu hook'u kullanmaz.
 */
export function useCancellationFeeCompute(
  stage: CaseBillingStage,
  estimate: number | null,
): CancellationFeeEstimate {
  return useMemo(() => {
    const stageLabels: Record<CaseBillingStage, string> = {
      pre_preauth: "Ödeme başlamadan iptal",
      preauth_held: "Ön yetki tutuluyor",
      scheduled_before_start: "Randevu öncesi",
      service_in_progress: "İş sürüyor",
      invoice_approval: "Fatura onayı",
      completed: "İş tamamlandı",
    };
    const baseAmount = estimate ?? 0;
    let feeAmount = 0;
    let waived = true;
    switch (stage) {
      case "pre_preauth":
      case "preauth_held":
      case "scheduled_before_start":
        feeAmount = 0;
        waived = true;
        break;
      case "service_in_progress":
        feeAmount = Math.round(baseAmount * 0.25);
        waived = false;
        break;
      case "invoice_approval":
      case "completed":
        // UI bu stage'de iptal butonu göstermeyecek — fallback.
        feeAmount = 0;
        waived = true;
        break;
    }
    return {
      fee_amount: feeAmount,
      currency: "TRY",
      stage_label: stageLabels[stage],
      waived,
    };
  }, [stage, estimate]);
}
