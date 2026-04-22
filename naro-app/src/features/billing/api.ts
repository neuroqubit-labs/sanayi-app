import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  BillingSummarySchema,
  CancellationRequestSchema,
  DisputeRequestSchema,
  PaymentInitiateResponseSchema,
  RefundOutSchema,
  type BillingSummary,
  type CancellationRequest,
  type DisputeRequest,
  type PaymentInitiateResponse,
  type RefundOut,
} from "./schemas";

/**
 * Billing API wrappers — naro-backend/app/api/v1/routes/billing.py (BE
 * billing Faz 1-2 shipped olunca aktifleşir). Hook signature ve Zod parse
 * şimdiden sabit; BE endpoint path'leri backend-billing-servisi-brief.md
 * §10'da tanımlı.
 *
 * Dev/mock fallback YOK — brief §LIVE_ENABLED_ENVS "REST CRUD her env live".
 * BE Faz 1 shipped olmadan bu hook'lar 404 döner; composer/billing
 * caller'ları BE sinyali gelene kadar bu hook'ları tüketmez (UI henüz
 * render etmiyor — B2 fazında ekran tarafı gelir).
 */

// ─── Payment initiation (§4.1) ──────────────────────────────────────────────

async function postPaymentInitiate(caseId: string): Promise<PaymentInitiateResponse> {
  const raw = await apiClient(`/cases/${caseId}/payment/initiate`, {
    method: "POST",
  });
  return PaymentInitiateResponseSchema.parse(raw);
}

export function useInitiatePayment(caseId: string) {
  return useMutation<PaymentInitiateResponse, Error, void>({
    mutationFn: () => postPaymentInitiate(caseId),
  });
}

// ─── Billing summary (§7) ──────────────────────────────────────────────────

export function useBillingSummary(caseId: string) {
  return useQuery<BillingSummary>({
    queryKey: ["billing", "summary", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}/billing/summary`);
      return BillingSummarySchema.parse(raw);
    },
    staleTime: 15 * 1000,
  });
}

// ─── Refund tracking ───────────────────────────────────────────────────────

export function useCaseRefunds(caseId: string) {
  return useQuery<RefundOut[]>({
    queryKey: ["billing", "refunds", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}/refunds`);
      return RefundOutSchema.array().parse(raw);
    },
    staleTime: 30 * 1000,
  });
}

// Approval (parts/invoice/completion) feature/approvals'a taşındı —
// useCaseApprovals + useDecideApproval. BE canonical path değişti:
// /cases/{case_id}/approvals + /decide.

// ─── Cancellation (§8) ─────────────────────────────────────────────────────

export function useSubmitCancellation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CancellationRequest>({
    mutationFn: async (payload) => {
      const body = CancellationRequestSchema.parse(payload);
      await apiClient(`/cases/${caseId}/cancel`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "summary", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

// ─── Dispute (§6.2) ────────────────────────────────────────────────────────

export function useSubmitDispute(approvalId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DisputeRequest>({
    mutationFn: async (payload) => {
      const body = DisputeRequestSchema.parse(payload);
      await apiClient(`/case-approvals/${approvalId}/dispute`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["billing", "approval", approvalId],
      });
    },
  });
}
