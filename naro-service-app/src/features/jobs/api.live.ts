import type { ServiceCase } from "@naro/domain";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  fetchPoolOrCanonicalCase,
  useAddJobEvidence,
  useApproveIncomingAppointment,
  useDeclineIncomingAppointment,
  useIncomingAppointments,
  useJobDetail,
  useJobTask,
  useJobThread,
  useJobsFeed,
  useMarkJobSeen,
  useMarkReadyForDelivery,
  usePoolCaseDetail,
  useRequestJobPartsApproval,
  useSendJobMessage,
  useShareJobInvoice,
  useShareJobStatusUpdate,
  useTechnicianTrackingJob,
} from "./api.case-live";
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
 * Service app jobs/offers/appointments live facade.
 * Yeni tüketiciler yalnız bu dosyadan veya `@/features/jobs` barrel'ından
 * import eder; mock API/store `*.mock.ts` altında karantinadadır.
 */

export {
  useAddJobEvidence,
  useApproveIncomingAppointment,
  useDeclineIncomingAppointment,
  useIncomingAppointments,
  useJobDetail,
  useJobTask,
  useJobThread,
  useJobsFeed,
  useMarkJobSeen,
  useMarkReadyForDelivery,
  usePoolCaseDetail,
  useRequestJobPartsApproval,
  useSendJobMessage,
  useShareJobInvoice,
  useShareJobStatusUpdate,
  useTechnicianTrackingJob,
};

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

export function useCasePool(limit: number = 20) {
  return useQuery<ServiceCase[]>({
    queryKey: ["pool", "feed", "service-case", "live", limit] as const,
    queryFn: async () => {
      const raw = await apiClient(buildPoolFeedPath({ limit }));
      const page = PaginatedPoolSchema.parse(raw);
      const items = await Promise.all(
        page.items.map(async (item) => {
          try {
            return await fetchPoolOrCanonicalCase(item.id);
          } catch {
            return null;
          }
        }),
      );
      return items
        .filter((item): item is ServiceCase => item !== null)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    },
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

export function useSubmitOffer() {
  return useSubmitOfferLive();
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
