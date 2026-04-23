import { z } from "zod";

/**
 * Approval canonical schemas — brief 2026-04-23 (PO karar, BE shipped).
 *
 * Endpoints:
 * - POST /api/v1/cases/{case_id}/approvals (technician creates)
 * - GET  /api/v1/cases/{case_id}/approvals (participant list)
 * - POST /api/v1/cases/{case_id}/approvals/{approval_id}/decide (customer)
 *
 * Decimal serialization: BE Pydantic v2 Decimal → string ("123.45").
 */

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

export const ApprovalLineItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string().nullable().optional(),
});
export type ApprovalLineItem = z.infer<typeof ApprovalLineItemSchema>;

export const ApprovalResponseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: CaseApprovalKindSchema,
  status: CaseApprovalStatusSchema,
  amount: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
  description: z.string().nullable().optional(),
  line_items: z.array(ApprovalLineItemSchema).default([]),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  resolver_note: z.string().nullable().optional(),
});
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;

// ─── Technician creates approval (service app) ─────────────────────────────

/**
 * BE canonical ApprovalRequestPayload (api-validation-hotlist 2026-04-23
 * P0-4): `title` ZORUNLU — service app usta onay talebi açarken kullanıcı
 * input'u ("Parça talebi başlığı" vb.).
 */
export const ApprovalRequestPayloadSchema = z.object({
  kind: CaseApprovalKindSchema,
  title: z.string().min(1).max(255),
  amount: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
  description: z.string().max(2000).nullable().optional(),
  line_items: z.array(ApprovalLineItemSchema).default([]).optional(),
});
export type ApprovalRequestPayload = z.infer<
  typeof ApprovalRequestPayloadSchema
>;

// ─── Customer decides approval ─────────────────────────────────────────────

export const ApprovalDecidePayloadSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).nullable().optional(),
});
export type ApprovalDecidePayload = z.infer<
  typeof ApprovalDecidePayloadSchema
>;
