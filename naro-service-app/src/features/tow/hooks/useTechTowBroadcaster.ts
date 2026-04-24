import type { TowDispatchStage } from "@naro/domain";
import {
  useLiveLocationBroadcaster,
  type LocationPostPayload,
  type UseLiveLocationBroadcasterResult,
} from "@naro/ui";
import { useCallback } from "react";

import { apiClient } from "@/runtime";

const ACTIVE_STAGES: TowDispatchStage[] = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "loading",
  "in_transit",
];

type Options = {
  caseId: string | null;
  stage: TowDispatchStage | null;
};

/**
 * Tech (çekici usta) tarafı broadcaster sarmalayıcısı.
 *
 * - Active stage'lerde (accepted..in_transit) broadcaster çalışır.
 * - Terminal (delivered/cancelled) veya caseId null → pasif.
 * - Dev cihaz smoke'unda da backend'e gider; çekici bulma mantığının kalbi
 *   canlı heartbeat olduğu için environment guard yok.
 */
export function useTechTowBroadcaster({
  caseId,
  stage,
}: Options): UseLiveLocationBroadcasterResult {
  const active =
    caseId !== null &&
    stage !== null &&
    ACTIVE_STAGES.includes(stage);

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
