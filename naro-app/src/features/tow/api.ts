import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  TowCancelInputSchema,
  TowCaseSnapshotSchema,
  TowCreateCaseRequestSchema,
  TowFareQuoteRequestSchema,
  TowFareQuoteResponseSchema,
  TowOtpChallengeSchema,
  TowPaymentInitiateResponseSchema,
  TowOtpVerifyInputSchema,
  TowRatingInputSchema,
  TowTrackingSnapshotSchema,
  type TowCancelInput,
  type TowCaseSnapshot,
  type TowCreateCaseRequest,
  type TowFareQuoteRequest,
  type TowFareQuoteResponse,
  type TowOtpChallenge,
  type TowPaymentInitiateResponse,
  type TowOtpVerifyInput,
  type TowRatingInput,
  type TowTrackingSnapshot,
} from "./schemas";

/**
 * Tow canonical wrappers — customer scope (P0-4 launch migration
 * 2026-04-23). Demo `useTowStore` artık yalnızca "preview mode"
 * (isolate route) için; launch path bu hook'ları kullanır.
 */

// ─── Fare quote (pre-create) ───────────────────────────────────────────────

export function useTowFareQuote() {
  return useMutation<TowFareQuoteResponse, Error, TowFareQuoteRequest>({
    mutationFn: async (payload) => {
      const body = TowFareQuoteRequestSchema.parse(payload);
      const raw = await apiClient(`/tow/fare/quote`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowFareQuoteResponseSchema.parse(raw);
    },
  });
}

export function useTowFareQuotePreview(payload: TowFareQuoteRequest | null) {
  return useQuery<TowFareQuoteResponse>({
    queryKey: ["tow", "fare-quote", payload],
    enabled: payload !== null,
    staleTime: 25_000,
    gcTime: 2 * 60_000,
    queryFn: async () => {
      if (!payload) {
        throw new Error("quote payload is required");
      }
      const body = TowFareQuoteRequestSchema.parse(payload);
      const raw = await apiClient(`/tow/fare/quote`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowFareQuoteResponseSchema.parse(raw);
    },
  });
}

// ─── Case lifecycle ────────────────────────────────────────────────────────

export function useCreateTowCase() {
  const queryClient = useQueryClient();
  return useMutation<TowCaseSnapshot, Error, TowCreateCaseRequest>({
    mutationFn: async (payload) => {
      const body = TowCreateCaseRequestSchema.parse(payload);
      const raw = await apiClient(`/tow/cases`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowCaseSnapshotSchema.parse(raw);
    },
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.setQueryData(["tow", "case", snapshot.id], snapshot);
    },
  });
}

export function useTowCaseSnapshot(caseId: string) {
  return useQuery<TowCaseSnapshot>({
    queryKey: ["tow", "case", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/tow/cases/${caseId}`);
      return TowCaseSnapshotSchema.parse(raw);
    },
    staleTime: 5 * 1000,
  });
}

export function useInitiateTowPayment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowPaymentInitiateResponse, Error, void>({
    mutationFn: async () => {
      const raw = await apiClient(`/tow/cases/${caseId}/payment/initiate`, {
        method: "POST",
        body: {},
      });
      return TowPaymentInitiateResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tow", "case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["tow", "tracking", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useAbandonTowPayment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowCaseSnapshot, Error, void>({
    mutationFn: async () => {
      const raw = await apiClient(`/tow/cases/${caseId}/payment/abandon`, {
        method: "POST",
        body: {},
      });
      return TowCaseSnapshotSchema.parse(raw);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["tow", "case", caseId], snapshot);
      queryClient.invalidateQueries({ queryKey: ["tow", "tracking", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useTowTracking(caseId: string, enabled: boolean = true) {
  return useQuery<TowTrackingSnapshot>({
    queryKey: ["tow", "tracking", caseId],
    enabled: enabled && caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/tow/cases/${caseId}/tracking`);
      return TowTrackingSnapshotSchema.parse(raw);
    },
    // Polling fallback; WS overlay hook ayrıca live location push eder.
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 2_000,
  });
}

// ─── Cancel / OTP / Rating ─────────────────────────────────────────────────

export function useCancelTowCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowCaseSnapshot, Error, TowCancelInput>({
    mutationFn: async (payload) => {
      const body = TowCancelInputSchema.parse(payload);
      const raw = await apiClient(`/tow/cases/${caseId}/cancel`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowCaseSnapshotSchema.parse(raw);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["tow", "case", caseId], snapshot);
      queryClient.invalidateQueries({ queryKey: ["tow", "tracking", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useVerifyTowOtp(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowOtpChallenge, Error, TowOtpVerifyInput>({
    mutationFn: async (payload) => {
      const body = TowOtpVerifyInputSchema.parse(payload);
      const raw = await apiClient(`/tow/cases/${caseId}/otp/verify`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowOtpChallengeSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tow", "case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["tow", "tracking", caseId] });
    },
  });
}

export function useSubmitTowRating(caseId: string) {
  return useMutation<void, Error, TowRatingInput>({
    mutationFn: async (payload) => {
      const body = TowRatingInputSchema.parse(payload);
      await apiClient(`/tow/cases/${caseId}/rating`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
    },
  });
}
