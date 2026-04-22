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

// ─── Approval parity (BE shipped: app/models/case_process.py) ──────────────

export const CaseApprovalKindSchema = z.enum([
  "parts_request",
  "invoice",
  "completion",
]);
export type CaseApprovalKind = z.infer<typeof CaseApprovalKindSchema>;

export const CaseApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type CaseApprovalStatus = z.infer<typeof CaseApprovalStatusSchema>;

export const CaseApprovalLineItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  value: z.string(),
  note: z.string().nullable().optional(),
  sequence: z.number().int(),
});
export type CaseApprovalLineItem = z.infer<typeof CaseApprovalLineItemSchema>;

export const CaseApprovalResponseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: CaseApprovalKindSchema,
  status: CaseApprovalStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  requested_by_user_id: z.string().uuid().nullable(),
  requested_by_snapshot_name: z.string().nullable(),
  requested_at: z.string(),
  responded_at: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().default("TRY"),
  service_comment: z.string().nullable(),
  line_items: z.array(CaseApprovalLineItemSchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseApprovalResponse = z.infer<typeof CaseApprovalResponseSchema>;

// ─── Payment initiation (brief §4.1) ───────────────────────────────────────

export const PaymentStatusSchema = z.enum([
  "preauth_requested",
  "preauth_held",
  "additional_hold_requested",
  "captured",
  "partial_refunded",
  "full_refunded",
  "kasko_pending",
  "kasko_reimbursed",
  "settled",
  "cancelled",
  "failed",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentInitiateResponseSchema = z.object({
  case_id: z.string().uuid(),
  payment: z.object({
    required: z.boolean(),
    status: PaymentStatusSchema,
    /** Iyzico checkout URL — mobil WebView source. Null ise 3DS gerekmez. */
    redirect_url: z.string().url().nullable(),
    /** Idempotency key — client retry güvenliği. */
    payment_id: z.string().uuid().nullable(),
  }),
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

// ─── Billing summary (brief §7) ────────────────────────────────────────────

export const BillingLineKindSchema = z.enum([
  "estimate",
  "parts_addition",
  "service_labor",
  "discount",
  "refund",
  "cancellation_fee",
  "commission", // admin-only, mobil response'ta YOK (I-9 PII benzeri mask)
  "kasko_reimbursement",
]);
export type BillingLineKind = z.infer<typeof BillingLineKindSchema>;

export const BillingLineSchema = z.object({
  id: z.string().uuid(),
  kind: BillingLineKindSchema,
  label: z.string(),
  amount: z.number(),
  currency: z.string().default("TRY"),
  created_at: z.string(),
});
export type BillingLine = z.infer<typeof BillingLineSchema>;

export const KaskoStatusSchema = z.enum([
  "not_applicable",
  "pending",
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
  "partially_reimbursed",
]);
export type KaskoStatus = z.infer<typeof KaskoStatusSchema>;

export const BillingSummarySchema = z.object({
  case_id: z.string().uuid(),
  estimate_amount: z.number().nullable(),
  preauth_total: z.number().nullable(),
  captured_amount: z.number().nullable(),
  refunded_amount: z.number().nullable(),
  final_amount: z.number().nullable(),
  currency: z.string().default("TRY"),
  payment_status: PaymentStatusSchema,
  kasko_status: KaskoStatusSchema.default("not_applicable"),
  invoice_url: z.string().url().nullable(),
  /** Kart son 4 hane — PII-safe. */
  card_last4: z.string().length(4).nullable(),
  lines: z.array(BillingLineSchema).default([]),
  /** Dispute açılmışsa + admin inceleme bilgisi. */
  dispute: z
    .object({
      opened_at: z.string(),
      state: z.enum([
        "opened",
        "admin_review",
        "resolved_capture",
        "resolved_refund",
        "resolved_partial",
      ]),
      resolution_note: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

// ─── Refund tracking (brief §7 + §8) ───────────────────────────────────────

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

export const CaseRefundSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  amount: z.number(),
  currency: z.string().default("TRY"),
  reason: RefundReasonSchema,
  state: RefundStateSchema,
  created_at: z.string(),
  completed_at: z.string().nullable(),
});
export type CaseRefund = z.infer<typeof CaseRefundSchema>;

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

// ─── Dispute (brief §6.2) ──────────────────────────────────────────────────

export const DisputeCategorySchema = z.enum([
  "work_not_done",
  "different_from_estimate",
  "quality_issue",
  "other",
]);
export type DisputeCategory = z.infer<typeof DisputeCategorySchema>;

export const DisputeRequestSchema = z.object({
  category: DisputeCategorySchema,
  detail: z.string().min(1).max(2000),
  attachment_media_ids: z.array(z.string().uuid()).default([]),
});
export type DisputeRequest = z.infer<typeof DisputeRequestSchema>;

// ─── Approval mutation bodies (parts + invoice decision) ────────────────────

export const ApprovalDecisionRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).nullable().optional(),
});
export type ApprovalDecisionRequest = z.infer<
  typeof ApprovalDecisionRequestSchema
>;

/**
 * Approve response — ek pre-auth gerekirse backend 3DS URL döner
 * (brief §5.3).
 */
export const ApprovalDecisionResponseSchema = z.object({
  approval: CaseApprovalResponseSchema,
  payment: z
    .object({
      required: z.boolean(),
      redirect_url: z.string().url().nullable(),
      payment_id: z.string().uuid().nullable(),
    })
    .nullable()
    .optional(),
});
export type ApprovalDecisionResponse = z.infer<
  typeof ApprovalDecisionResponseSchema
>;
