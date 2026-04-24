import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  TowAvailabilityInputSchema,
  TowAvailabilityOutputSchema,
  TowCaseSnapshotSchema,
  TowDispatchResponseInputSchema,
  TowDispatchResponseOutputSchema,
  TowOtpChallengeSchema,
  TowOtpIssueInputSchema,
  TowOtpVerifyInputSchema,
  TowOtpVerifyOutputSchema,
  TowPendingDispatchSchema,
  TowStageTransitionInputSchema,
  TowTrackingSnapshotSchema,
  type TowAvailabilityInput,
  type TowAvailabilityOutput,
  type TowCaseSnapshot,
  type TowDispatchResponseInput,
  type TowDispatchResponseOutput,
  type TowEvidenceKind,
  type TowOtpChallenge,
  type TowOtpIssueInput,
  type TowOtpVerifyInput,
  type TowOtpVerifyOutput,
  type TowPendingDispatch,
  type TowStageTransitionInput,
  type TowTrackingSnapshot,
} from "./schemas";

/**
 * Service app tow canonical wrappers — P0-5 launch migration 2026-04-23.
 * Canonical endpoint'ler:
 * - POST /tow/technicians/me/availability (online/offline + heartbeat)
 * - GET /tow/technicians/me/dispatches/pending (incoming dispatch)
 * - GET /tow/technicians/me/active-case (aktif iş)
 * - POST /tow/cases/{case_id}/dispatch/response (accept/decline)
 * - POST /tow/cases/{case_id}/stage (teknisyen stage transition)
 * - POST /tow/cases/{case_id}/otp/issue (teknisyen tarafı)
 * - POST /tow/cases/{case_id}/otp/verify (teknisyen verify recipient)
 * - POST /tow/cases/{case_id}/evidence (query param kind + media_asset_id)
 */

export function useTowAvailability(enabled: boolean = true) {
  return useQuery<TowAvailabilityOutput>({
    queryKey: ["tow", "availability", "current"],
    enabled,
    queryFn: async () => {
      const raw = await apiClient(`/tow/technicians/me/availability`);
      return TowAvailabilityOutputSchema.parse(raw);
    },
    staleTime: 5_000,
  });
}

export function useSetTowAvailability() {
  const queryClient = useQueryClient();
  return useMutation<TowAvailabilityOutput, Error, TowAvailabilityInput>({
    mutationFn: async (payload) => {
      const body = TowAvailabilityInputSchema.parse(payload);
      const raw = await apiClient(`/tow/technicians/me/availability`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowAvailabilityOutputSchema.parse(raw);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["tow", "availability", "current"], data);
      queryClient.invalidateQueries({ queryKey: ["tow", "pending-dispatch"] });
    },
  });
}

export function usePendingTowDispatch(enabled: boolean = true) {
  return useQuery<TowPendingDispatch | null>({
    queryKey: ["tow", "pending-dispatch"],
    enabled,
    queryFn: async () => {
      const raw = await apiClient(`/tow/technicians/me/dispatches/pending`);
      return raw === null ? null : TowPendingDispatchSchema.parse(raw);
    },
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 1_000,
  });
}

export function useActiveTowCase(enabled: boolean = true) {
  return useQuery<TowCaseSnapshot | null>({
    queryKey: ["tow", "active-case"],
    enabled,
    queryFn: async () => {
      const raw = await apiClient(`/tow/technicians/me/active-case`);
      return raw === null ? null : TowCaseSnapshotSchema.parse(raw);
    },
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 2_000,
  });
}

export function useRespondDispatch(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowDispatchResponseOutput, Error, TowDispatchResponseInput>(
    {
      mutationFn: async (payload) => {
        const body = TowDispatchResponseInputSchema.parse(payload);
        const raw = await apiClient(
          `/tow/cases/${caseId}/dispatch/response`,
          {
            method: "POST",
            body: JSON.parse(JSON.stringify(body)),
          },
        );
        return TowDispatchResponseOutputSchema.parse(raw);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["tow", "active-job"] });
        queryClient.invalidateQueries({ queryKey: ["tow", "active-case"] });
        queryClient.invalidateQueries({ queryKey: ["tow", "pending-dispatch"] });
      },
    },
  );
}

export function useTransitionTowStage(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowCaseSnapshot, Error, TowStageTransitionInput>({
    mutationFn: async (payload) => {
      const body = TowStageTransitionInputSchema.parse(payload);
      const raw = await apiClient(`/tow/cases/${caseId}/stage`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowCaseSnapshotSchema.parse(raw);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["tow", "case", "tech", caseId], snapshot);
      queryClient.invalidateQueries({ queryKey: ["tow", "tracking", "tech", caseId] });
      queryClient.invalidateQueries({ queryKey: ["tow", "active-case"] });
    },
  });
}

export function useIssueTowOtp(caseId: string) {
  return useMutation<TowOtpChallenge, Error, TowOtpIssueInput>({
    mutationFn: async (payload) => {
      const body = TowOtpIssueInputSchema.parse(payload);
      const raw = await apiClient(`/tow/cases/${caseId}/otp/issue`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowOtpChallengeSchema.parse(raw);
    },
  });
}

export function useVerifyTowOtpTech(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<TowOtpVerifyOutput, Error, TowOtpVerifyInput>({
    mutationFn: async (payload) => {
      const body = TowOtpVerifyInputSchema.parse(payload);
      const raw = await apiClient(`/tow/cases/${caseId}/otp/verify`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return TowOtpVerifyOutputSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tow", "case", "tech", caseId] });
    },
  });
}

type RegisterEvidenceInput = {
  kind: TowEvidenceKind;
  media_asset_id?: string | null;
};

/**
 * Evidence endpoint query-param based (BE signature: kind + media_asset_id
 * query). Body yok; URL builder manuel.
 */
export function useRegisterTowEvidence(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, RegisterEvidenceInput>({
    mutationFn: async (input) => {
      const params = new URLSearchParams();
      params.set("kind", input.kind);
      if (input.media_asset_id) {
        params.set("media_asset_id", input.media_asset_id);
      }
      await apiClient(
        `/tow/cases/${caseId}/evidence?${params.toString()}`,
        { method: "POST" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tow", "case", "tech", caseId] });
    },
  });
}

// ─── Case snapshot + tracking (teknisyen polling, P0-5 iter 2) ─────────────

export function useTowCaseSnapshotTech(caseId: string) {
  return useQuery<TowCaseSnapshot>({
    queryKey: ["tow", "case", "tech", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/tow/cases/${caseId}`);
      return TowCaseSnapshotSchema.parse(raw);
    },
    // Polling 5 sn — BE realtime push V1.1; teknisyen stage transitions
    // için düşük latency gerekli (accepted→en_route→arrived).
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
}

export function useTowTrackingTech(caseId: string, enabled: boolean = true) {
  return useQuery<TowTrackingSnapshot>({
    queryKey: ["tow", "tracking", "tech", caseId],
    enabled: enabled && caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/tow/cases/${caseId}/tracking`);
      return TowTrackingSnapshotSchema.parse(raw);
    },
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 2_000,
  });
}
