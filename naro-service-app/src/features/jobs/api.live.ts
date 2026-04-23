import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  AppointmentDeclineRequestSchema,
  OfferResponseSchema,
  OfferSubmitPayloadSchema,
  PaginatedPoolSchema,
  PoolCaseDetailSchema,
  type AppointmentDeclineRequest,
  type OfferResponse,
  type OfferSubmitPayload,
  type PaginatedPool,
  type PoolCaseDetail,
} from "./schemas";

/**
 * Service app jobs/offers/appointments canonical hooks — P1-4 launch
 * migration 2026-04-23. Eski features/jobs/api.ts mock paralel kalıyor
 * (Cleaner Hat B consumer migration + söküm); yeni tüketiciler buraya.
 *
 * Approval create (parts_request / invoice / completion) feature/approvals
 * altında `useCreateCaseApproval` olarak yazılacak — bu dosya offer +
 * appointment scope'unda.
 */

// ─── Pool feed + detail (cursor paginated) ─────────────────────────────────

type PoolFilters = {
  cursor?: string | null;
  limit?: number;
};

function buildPoolFeedPath(filters: PoolFilters): string {
  const params = new URLSearchParams();
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return `/pool/feed${qs ? `?${qs}` : ""}`;
}

export function useCasePoolLive(limit: number = 20) {
  return useInfiniteQuery({
    queryKey: ["pool", "feed", "live", limit] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const raw = await apiClient(
        buildPoolFeedPath({ cursor: pageParam, limit }),
      );
      return PaginatedPoolSchema.parse(raw);
    },
    getNextPageParam: (lastPage: PaginatedPool): string | null =>
      lastPage.next_cursor,
    staleTime: 30 * 1000,
  });
}

export function usePoolCaseDetailLive(caseId: string) {
  return useQuery<PoolCaseDetail>({
    queryKey: ["pool", "detail", "live", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/pool/case/${caseId}`);
      return PoolCaseDetailSchema.parse(raw);
    },
    staleTime: 15 * 1000,
  });
}

// ─── Offer submit (teknisyen) ──────────────────────────────────────────────

export function useSubmitOfferLive() {
  const queryClient = useQueryClient();
  return useMutation<OfferResponse, Error, OfferSubmitPayload>({
    mutationFn: async (payload) => {
      const body = OfferSubmitPayloadSchema.parse(payload);
      const raw = await apiClient(`/offers`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return OfferResponseSchema.parse(raw);
    },
    onSuccess: () => {
      // Teknisyenin kendi teklifleri + pool cache invalidate.
      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

// ─── Appointment approve/decline (teknisyen) ───────────────────────────────

export function useApproveAppointmentLive(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient(`/appointments/${appointmentId}/approve`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useDeclineAppointmentLive(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, AppointmentDeclineRequest>({
    mutationFn: async (payload) => {
      const body = AppointmentDeclineRequestSchema.parse(payload);
      await apiClient(`/appointments/${appointmentId}/decline`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

// ─── Counter-propose (teknisyen) ───────────────────────────────────────────

/**
 * BE /appointments/{id}/counter-propose — body: { new_slot: AppointmentSlot }
 */
type CounterProposePayload = {
  new_slot: {
    kind: "today" | "tomorrow" | "custom" | "flexible";
    dateLabel?: string | null;
    timeWindow?: string | null;
  };
};

export function useCounterProposeAppointmentLive(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CounterProposePayload>({
    mutationFn: async (payload) => {
      await apiClient(`/appointments/${appointmentId}/counter-propose`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(payload)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}
