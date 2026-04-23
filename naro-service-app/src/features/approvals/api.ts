import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  ApprovalRequestPayloadSchema,
  ApprovalResponseSchema,
  type ApprovalRequestPayload,
  type ApprovalResponse,
} from "./schemas";

/**
 * Service app approvals canonical wrappers — P1-4 launch migration.
 * Teknisyen `POST /cases/{id}/approvals` ile talep açar; customer
 * feature/approvals/api (ayrı app) decide eder.
 */

export function useCaseApprovalsLive(caseId: string) {
  return useQuery<ApprovalResponse[]>({
    queryKey: ["approvals", "live", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}/approvals`);
      return ApprovalResponseSchema.array().parse(raw);
    },
    staleTime: 15 * 1000,
  });
}

export function useCreateCaseApprovalLive(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<ApprovalResponse, Error, ApprovalRequestPayload>({
    mutationFn: async (payload) => {
      const body = ApprovalRequestPayloadSchema.parse(payload);
      const raw = await apiClient(`/cases/${caseId}/approvals`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return ApprovalResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["approvals", "live", caseId],
      });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
