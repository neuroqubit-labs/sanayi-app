/**
 * Approval schemas — case_approvals HTTP contract (BE Pydantic parity).
 *
 * Endpoints:
 * - POST /api/v1/cases/{case_id}/approvals       (technician creates)
 * - GET  /api/v1/cases/{case_id}/approvals       (participant list)
 * - POST /api/v1/cases/{case_id}/approvals/{id}/decide (customer decides)
 *
 * Kind + Status enumları hem FE hem BE'de 1:1 eşleşir. Detail read modeli
 * (CaseApprovalSchema — id/requested_by/evidence_document_ids'li dossier
 * shape) `service-case.ts`'te kalır; aggregate case dossier orada.
 *
 * Decimal serialization: BE Pydantic v2 Decimal → string ("123.45").
 */

import { z } from "zod";

// ─── Enum'lar ───────────────────────────────────────────────────────────────

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

export const ApprovalPaymentMethodSchema = z.enum([
  "online",
  "service_card",
  "cash",
]);
export type ApprovalPaymentMethod = z.infer<
  typeof ApprovalPaymentMethodSchema
>;

export const ApprovalPaymentStateSchema = z.enum([
  "not_required",
  "required",
  "requested",
  "paid",
  "offline_recorded",
  "failed",
]);
export type ApprovalPaymentState = z.infer<typeof ApprovalPaymentStateSchema>;

// ─── Line item (HTTP shape) ─────────────────────────────────────────────────

/**
 * HTTP line item — BE ApprovalLineItemInput/Out ile 1:1. Detail dossier
 * modeli `CaseApprovalLineItemSchema` (service-case.ts) id'li, farklı
 * shape — karıştırma.
 */
export const ApprovalLineItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string().nullable().optional(),
});
export type ApprovalLineItem = z.infer<typeof ApprovalLineItemSchema>;

// ─── Response (BE → FE) ─────────────────────────────────────────────────────

export const ApprovalResponseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: CaseApprovalKindSchema,
  status: CaseApprovalStatusSchema,
  amount: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
  description: z.string().nullable().optional(),
  service_comment: z.string().nullable().optional(),
  payment_method: ApprovalPaymentMethodSchema.nullable().optional(),
  payment_state: ApprovalPaymentStateSchema.default("not_required"),
  payment_order_id: z.string().uuid().nullable().optional(),
  available_payment_methods: z.array(ApprovalPaymentMethodSchema).default([]),
  line_items: z.array(ApprovalLineItemSchema).default([]),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  resolver_note: z.string().nullable().optional(),
});
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;

// ─── Teknisyen onay talebi oluşturur (service-app) ──────────────────────────

/**
 * BE canonical ApprovalRequestPayload (api-validation-hotlist 2026-04-23
 * P0-4): `title` ZORUNLU — usta onay talebi başlığı (ör. "Parça talebi").
 *
 * COMPLETION kind'ında public showcase consent + media seçimi birlikte
 * gelir; BE case_public_showcases service'e yazar (teknisyen izni).
 */
export const ApprovalRequestPayloadSchema = z.object({
  kind: CaseApprovalKindSchema,
  title: z.string().min(1).max(255),
  amount: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
  description: z.string().max(2000).nullable().optional(),
  service_comment: z.string().max(2000).nullable().optional(),
  line_items: z.array(ApprovalLineItemSchema).default([]).optional(),
  delivery_report: z.record(z.string(), z.unknown()).nullable().optional(),
  public_showcase_consent: z.boolean().default(false).optional(),
  public_showcase_media_ids: z.array(z.string().uuid()).default([]).optional(),
});
export type ApprovalRequestPayload = z.infer<
  typeof ApprovalRequestPayloadSchema
>;

// ─── Müşteri karar verir (customer-app) ─────────────────────────────────────

/**
 * COMPLETION kind approve edildiğinde `rating` zorunlu (BE 422
 * "completion_rating_required" döner); review kaydı otomatik oluşur +
 * `public_showcase_consent=true` ise müşteri tarafı da showcase'e
 * consent vermiş sayılır → iki taraf publish'e geçer.
 */
export const ApprovalDecidePayloadSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  review_body: z.string().max(2000).nullable().optional(),
  public_showcase_consent: z.boolean().default(false).optional(),
  payment_method: ApprovalPaymentMethodSchema.optional(),
});
export type ApprovalDecidePayload = z.infer<
  typeof ApprovalDecidePayloadSchema
>;
