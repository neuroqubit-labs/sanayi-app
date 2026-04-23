import { z } from "zod";

/**
 * Service app approval canonical schemas — BE parity
 * app/api/v1/routes/approvals.py. Teknisyen approval talep açar,
 * customer decide eder. Customer scope features/approvals/ customer-app
 * içinde; service-app bu dosya create-side.
 *
 * Create payload BE extra=forbid + title ZORUNLU
 * (api-validation-hotlist P0-4 canonical hizalama).
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
