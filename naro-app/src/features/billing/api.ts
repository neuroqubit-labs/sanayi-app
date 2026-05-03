import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  BillingSummarySchema,
  CancellationRequestSchema,
  PaymentInitiateResponseSchema,
  type BillingSummary,
  type CancellationRequest,
  type PaymentInitiateResponse,
} from "./schemas";

/**
 * Billing canonical wrappers — tow-priority audit 2026-04-23 P1-1 sonrası
 * hizalandı.
 *
 * Approval (parts/invoice/completion): feature/approvals'a taşındı
 * (useCaseApprovals + useDecideApproval; /cases/{id}/approvals +
 * /{id}/decide canonical).
 *
 * Refund list: BE'de ayrı endpoint yok (V1); refunds BillingSummary.refunds[]
 * içinde inline döner. Ayrı useCaseRefunds hook'u kaldırıldı.
 *
 * Dispute: BE'de endpoint yok (V1.1 scope); useSubmitDispute hook'u
 * kaldırıldı.
 */

// ─── Payment initiation (brief §4.1) ───────────────────────────────────────

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

// ─── Payment abandon (F1.1, BE 2026-04-28) ─────────────────────────────────

/**
 * 3DS WebView'i finalize etmeden kapatınca BE'ye abandon notify et:
 * billing_state PREAUTH_REQUESTED → ESTIMATE'e döner ve idempotency
 * PENDING kayıtları FAILED'e çekilir. Kullanıcı `/payment/initiate`'i
 * retry_N anahtarıyla yeniden tetikleyebilir.
 *
 * BE 409 (`payment_abandon_not_allowed`) durumunda — para gerçek tutuluyor
 * (PREAUTH_HELD/CAPTURED) — caller `/cancel-billing` flow'una yönlendirmeli.
 */
export function useAbandonPayment(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient(`/cases/${caseId}/payment/abandon`, {
        method: "POST",
      });
    },
    onSettled: () => {
      // Hata yutulsa da summary refetch — gerçek state BE'den okunsun
      queryClient.invalidateQueries({
        queryKey: ["billing", "summary", caseId],
      });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

// ─── Billing summary (brief §7) ────────────────────────────────────────────

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

// ─── Cancellation (brief §8, canonical /cancel-billing) ────────────────────

export function useSubmitCancellation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CancellationRequest>({
    mutationFn: async (payload) => {
      // BE V1: body ignore (204 No Content, %0 fee hardcoded). FE reason/
      // comment V1.1'de BE analytics için store edilecek (audit notu).
      const body = CancellationRequestSchema.parse(payload);
      await apiClient(`/cases/${caseId}/cancel-billing`, {
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
