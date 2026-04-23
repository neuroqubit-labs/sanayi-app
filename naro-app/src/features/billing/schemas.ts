import { z } from "zod";

/**
 * Billing Zod schemas — Frontend Billing Wire-up Brief §4-§8 + BE
 * Pydantic parity (naro-backend/app/schemas/case_process.py + billing
 * Faz 1 sonrası eklenecek app/schemas/billing.py).
 *
 * BE billing Faz 1-2 shipped edilmeden bazı schema'lar tahmine dayalı;
 * endpoint shipped olduğunda bu dosya re-aligned edilir (schema parity
 * source-of-truth BE Pydantic'tir).
 */

// Approval schema'ları feature/approvals/schemas.ts'e taşındı (canonical
// BE shipped 2026-04-23 — brief). Bu dosya artık sadece billing scope'u.

// ─── Billing state machine (brief §4-§7, parity audit P0-2 canonical) ──────

/**
 * 14-state machine — BE canonical enums.md. FE helper group mapping aşağıda.
 */
export const BillingStateSchema = z.enum([
  "estimate",
  "preauth_requested",
  "preauth_held",
  "preauth_failed",
  "additional_hold_requested",
  "additional_held",
  "captured",
  "kasko_pending",
  "kasko_reimbursed",
  "kasko_rejected",
  "partial_refunded",
  "full_refunded",
  "settled",
  "cancelled",
]);
export type BillingState = z.infer<typeof BillingStateSchema>;

export type BillingStateGroup =
  | "pending"
  | "held"
  | "captured"
  | "refunded"
  | "failed"
  | "done";

/**
 * BillingSummaryCard + PaymentInitiate UI için 6 grup mapping.
 * Renk / ikon / tone kararları bu 6 gruba bağlanır.
 */
export function billingStateGroup(state: BillingState): BillingStateGroup {
  switch (state) {
    case "estimate":
    case "preauth_requested":
    case "additional_hold_requested":
      return "pending";
    case "preauth_held":
    case "additional_held":
      return "held";
    case "captured":
    case "kasko_pending":
    case "kasko_reimbursed":
      return "captured";
    case "partial_refunded":
    case "full_refunded":
    case "kasko_rejected":
      return "refunded";
    case "preauth_failed":
      return "failed";
    case "settled":
    case "cancelled":
      return "done";
  }
}

// ─── Payment initiation (brief §4.1) ───────────────────────────────────────

/**
 * BE canonical flat response — brief §4.1 + parity audit P0-1 (2026-04-22):
 * - `checkout_url` → Iyzico WebView source (her zaman döner; peşin ödeme
 *   gerekmiyorsa endpoint çağrılmaz)
 * - `idempotency_key` → PSP retry güvenliği (FE telemetry + retry)
 * - `preauth_amount` → Decimal string (BE Pydantic v2 Decimal serialize)
 * - 3DS `payment_id` callback URL query'den gelir (ThreeDSCallbackParams),
 *   initiate response'ta yoktur.
 */
export const PaymentInitiateResponseSchema = z.object({
  checkout_url: z.string().url(),
  idempotency_key: z.string(),
  preauth_amount: z.string(),
  case_id: z.string().uuid(),
});
export type PaymentInitiateResponse = z.infer<
  typeof PaymentInitiateResponseSchema
>;

/** 3DS callback URL'den parse edilen payload. */
export const ThreeDSCallbackParamsSchema = z.object({
  payment_id: z.string().uuid(),
  status: z.enum(["success", "fail"]),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});
export type ThreeDSCallbackParams = z.infer<typeof ThreeDSCallbackParamsSchema>;

// ─── Refund tracking (brief §7 + §8, BE canonical flat) ───────────────────

export const RefundReasonSchema = z.enum([
  "cancellation",
  "dispute",
  "excess_preauth",
  "kasko_reimbursement",
  "admin_override",
]);
export type RefundReason = z.infer<typeof RefundReasonSchema>;

export const RefundStateSchema = z.enum(["pending", "success", "failed"]);
export type RefundState = z.infer<typeof RefundStateSchema>;

/**
 * BE canonical response (api-validation-hotlist 2026-04-23 P0-3): BE
 * RefundOut `case_id` döndürmüyor (refund BillingSummary.refunds[] nested
 * olarak case bağlamında; case_id UI'da kullanılmıyor). datetime alanları
 * da optional (BE her zaman doldurmuyor).
 */
export const RefundOutSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid().nullable().optional(),
  amount: z.string(),
  reason: RefundReasonSchema,
  state: RefundStateSchema,
  created_at: z.string().nullable().optional(),
  completed_at: z.string().nullable(),
});
export type RefundOut = z.infer<typeof RefundOutSchema>;

// ─── Kasko (B-5 bayrak, BillingSummary nested) ─────────────────────────────

export const KaskoStateSchema = z.enum([
  "pending",
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
  "partially_reimbursed",
]);
export type KaskoState = z.infer<typeof KaskoStateSchema>;

export const KaskoSummarySchema = z.object({
  state: KaskoStateSchema,
  reimbursement_amount: z.string().nullable(),
  submitted_at: z.string().nullable(),
  reimbursed_at: z.string().nullable(),
});
export type KaskoSummary = z.infer<typeof KaskoSummarySchema>;

// ─── Billing summary (brief §7 + parity audit P0-2 canonical flat) ─────────

export const BillingSummarySchema = z.object({
  case_id: z.string().uuid(),
  billing_state: BillingStateSchema,
  estimate_amount: z.string().nullable(),
  preauth_amount: z.string().nullable(),
  final_amount: z.string().nullable(),
  approved_parts_total: z.string().default("0.00"),
  refunds: z.array(RefundOutSchema).default([]),
  kasko: KaskoSummarySchema.nullable().default(null),
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

// ─── Cancellation (brief §8) ───────────────────────────────────────────────

export const CancellationReasonSchema = z.enum([
  "changed_mind",
  "price_changed",
  "no_response",
  "other",
]);
export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

export const CancellationFeeEstimateSchema = z.object({
  fee_amount: z.number(),
  currency: z.string().default("TRY"),
  stage_label: z.string(),
  waived: z.boolean(),
});
export type CancellationFeeEstimate = z.infer<
  typeof CancellationFeeEstimateSchema
>;

export const CancellationRequestSchema = z.object({
  reason: CancellationReasonSchema,
  comment: z.string().max(500).nullable().optional(),
});
export type CancellationRequest = z.infer<typeof CancellationRequestSchema>;

// Dispute schema V1.1'e ertelendi — BE'de endpoint yok (tow-priority
// audit 2026-04-23 P1-1 + contract matrix "BE fix veya feature erteleme").

// ApprovalDecision* feature/approvals'a taşındı.
