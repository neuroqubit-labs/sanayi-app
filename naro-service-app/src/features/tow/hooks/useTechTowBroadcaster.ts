import type { TowDispatchStage } from "@naro/domain";
import {
  useLiveLocationBroadcaster,
  type LocationPostPayload,
  type UseLiveLocationBroadcasterResult,
} from "@naro/ui";
import { useCallback } from "react";

import { apiClient, env } from "@/runtime";

const ACTIVE_STAGES: TowDispatchStage[] = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "loading",
  "in_transit",
];

const LIVE_ENABLED_ENVS = new Set(["production", "staging"]);

type Options = {
  caseId: string | null;
  stage: TowDispatchStage | null;
};

/**
 * Tech (çekici usta) tarafı broadcaster sarmalayıcısı.
 *
 * - Active stage'lerde (accepted..in_transit) broadcaster çalışır.
 * - Terminal (delivered/cancelled) veya caseId null → pasif.
 * - Dev/mock env'de wsUrl benzeri guard yok (POST endpoint); yine de
 *   LIVE_ENABLED_ENVS kontrolü ile sadece prod/staging'de backend'e gönderir,
 *   aksi halde sadece local queue'da birikir (dev'de console gürültüsü
 *   yapmasın diye).
 */
export function useTechTowBroadcaster({
  caseId,
  stage,
}: Options): UseLiveLocationBroadcasterResult {
  const active =
    caseId !== null &&
    stage !== null &&
    ACTIVE_STAGES.includes(stage) &&
    LIVE_ENABLED_ENVS.has(env.appEnv);

  const sendLocation = useCallback(
    async (payload: LocationPostPayload) => {
      if (!caseId) return;
      // Canonical backend route: /api/v1/tow/cases/{case_id}/location
      // (tow-priority audit 2026-04-23 P0-5; apiClient baseUrl zaten /api/v1).
      await apiClient(`/tow/cases/${caseId}/location`, {
        method: "POST",
        body: payload,
      });
    },
    [caseId],
  );

  return useLiveLocationBroadcaster({
    caseId: caseId ?? "",
    active,
    sendLocation,
  });
}
