import {
  useLiveTowLocation,
  type UseLiveTowLocationResult,
} from "@naro/ui";
import { useMemo } from "react";

import { env, useAuthStore } from "@/runtime";

const LIVE_ENABLED_ENVS = new Set(["production", "staging"]);

/**
 * Müşteri vaka ekranı için live WS kanalı.
 *
 * Dev/mock'ta `enabled=false` → hook no-op; production/staging'de
 * `wss://<api>/ws/tow/<caseId>?token=<jwt>` bağlanır.
 *
 * Mevcut Zustand mock store değişmez; bu hook additive çalışır:
 * - `isConnected` → UI bağlantı rozeti
 * - `latest` → map overlay anında güncel konum (mock ticker ile paralel;
 *   caller tercih ederse override eder)
 * - `pickupOtp` → arrived event'ten OTP kodu (server-pushed)
 * - `stage` → server'dan gelen stage değişiklikleri
 */
export function useTowLiveChannel(caseId: string | null): UseLiveTowLocationResult {
  const accessToken = useAuthStore((s) => s.accessToken);
  const apiUrl = env.apiUrl;

  const wsUrl = useMemo(() => {
    if (!caseId || !accessToken) return null;
    if (!LIVE_ENABLED_ENVS.has(env.appEnv)) return null;
    const wsBase = apiUrl
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:")
      .replace(/\/api\/v1\/?$/, "");
    return `${wsBase}/ws/tow/${caseId}?token=${encodeURIComponent(accessToken)}`;
  }, [apiUrl, caseId, accessToken]);

  return useLiveTowLocation({
    caseId: caseId ?? "",
    role: "customer",
    wsUrl,
    enabled: wsUrl !== null,
  });
}
