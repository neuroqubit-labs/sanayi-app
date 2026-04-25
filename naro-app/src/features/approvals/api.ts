import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/runtime";

import {
  ApprovalDecidePayloadSchema,
  ApprovalResponseSchema,
  type ApprovalDecidePayload,
  type ApprovalResponse,
} from "./schemas";

export const PaymentInitiateResponseSchema = z.object({
  payment_order_id: z.string().uuid(),
  payment_attempt_id: z.string().uuid(),
  checkout_url: z.string(),
  amount: z.string(),
  currency: z.string().default("TRY"),
  expires_at: z.string().nullable().optional(),
  payment_mode: z.enum(["preauth_capture", "direct_capture"]),
});
export type PaymentInitiateResponse = z.infer<
  typeof PaymentInitiateResponseSchema
>;

/**
 * Canonical wrappers — BE shipped 2026-04-23. Eski billing/api.ts'teki
 * `/case-approvals/*` path'leri geçersiz; bu feature kullanılır.
 */

export function useCaseApprovals(caseId: string) {
  return useQuery<ApprovalResponse[]>({
    queryKey: ["approvals", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}/approvals`);
      return ApprovalResponseSchema.array().parse(raw);
    },
    staleTime: 15 * 1000,
  });
}

export function useDecideApproval(caseId: string, approvalId: string) {
  const queryClient = useQueryClient();
  return useMutation<ApprovalResponse, Error, ApprovalDecidePayload>({
    mutationFn: async (payload) => {
      const body = ApprovalDecidePayloadSchema.parse(payload);
      const raw = await apiClient(
        `/cases/${caseId}/approvals/${approvalId}/decide`,
        {
          method: "POST",
          body: JSON.parse(JSON.stringify(body)),
        },
      );
      return ApprovalResponseSchema.parse(raw);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["approvals", caseId] });
      queryClient.invalidateQueries({ queryKey: ["technicians", "public"] });
      queryClient.invalidateQueries({
        queryKey: ["billing", "summary", response.case_id],
      });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useInitiateApprovalPayment(caseId: string, approvalId: string) {
  const queryClient = useQueryClient();
  return useMutation<PaymentInitiateResponse, Error, void>({
    mutationFn: async () => {
      const raw = await apiClient(
        `/cases/${caseId}/approvals/${approvalId}/payment/initiate`,
        { method: "POST" },
      );
      return PaymentInitiateResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
