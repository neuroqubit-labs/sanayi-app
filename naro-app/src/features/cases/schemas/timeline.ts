import { z } from "zod";

/**
 * Case documents + events canonical wire schemas — BE parity
 * app/schemas/case_document.py (İş 5 shipped commit 2e23123).
 *
 * Endpoint haritası:
 * - GET /cases/{id}/documents — immediate list (no cursor pilot V1)
 * - GET /cases/{id}/events    — timeline ASC cursor paginated (50/page)
 *
 * Bu iki stream engine canonical rewrite'ın (İŞ B iter 2) primary
 * kaynakları; mock ServiceCase'teki `documents[]` + `events[]` bunları
 * değiştirir.
 */

export const CaseDocumentKindSchema = z.enum([
  "damage_photo",
  "invoice",
  "kasko_form",
  "police_report",
  "parts_receipt",
  "other",
]);
export type CaseDocumentKind = z.infer<typeof CaseDocumentKindSchema>;

export const CaseDocumentUploaderRoleSchema = z.enum([
  "customer",
  "technician",
  "admin",
]);
export type CaseDocumentUploaderRole = z.infer<
  typeof CaseDocumentUploaderRoleSchema
>;

export const CaseAntivirusVerdictSchema = z.enum([
  "clean",
  "pending",
  "infected",
]);
export type CaseAntivirusVerdict = z.infer<typeof CaseAntivirusVerdictSchema>;

export const CaseDocumentItemSchema = z.object({
  id: z.string().uuid(),
  kind: CaseDocumentKindSchema,
  title: z.string(),
  signed_url: z.string(),
  uploader_role: CaseDocumentUploaderRoleSchema.nullable().optional(),
  uploader_user_id: z.string().uuid().nullable().optional(),
  uploaded_at: z.string(),
  size_bytes: z.number().int().nonnegative(),
  mime_type: z.string(),
  antivirus_verdict: CaseAntivirusVerdictSchema,
});
export type CaseDocumentItem = z.infer<typeof CaseDocumentItemSchema>;

export const CaseDocumentListResponseSchema = z.object({
  items: z.array(CaseDocumentItemSchema),
});
export type CaseDocumentListResponse = z.infer<
  typeof CaseDocumentListResponseSchema
>;

// ─── Events (timeline) ─────────────────────────────────────────────────────

/**
 * BE enum parity — app/models/case_audit.py CaseEventType (46 değer).
 * Pilot scope mobil UI sadece bir alt kümesini işler; bilinmeyen değer
 * geldiğinde Zod tasıır (union genişletmek için `.catchall(z.string())`
 * değil; BE drift'lerini bilinçli olarak fail ettiriyor).
 */
export const CaseEventTypeSchema = z.enum([
  "submitted",
  "offer_received",
  "offer_accepted",
  "offer_rejected",
  "offer_withdrawn",
  "appointment_requested",
  "appointment_approved",
  "appointment_declined",
  "appointment_cancelled",
  "appointment_expired",
  "appointment_counter",
  "technician_selected",
  "technician_unassigned",
  "status_update",
  "parts_requested",
  "parts_approved",
  "parts_rejected",
  "invoice_shared",
  "invoice_approved",
  "evidence_added",
  "document_added",
  "message",
  "wait_state_changed",
  "completed",
  "cancelled",
  "archived",
  "soft_deleted",
  "insurance_claim_submitted",
  "insurance_claim_accepted",
  "insurance_claim_paid",
  "insurance_claim_rejected",
  "tow_stage_requested",
  "tow_stage_committed",
  "tow_evidence_added",
  "tow_location_recorded",
  "tow_fare_captured",
  "tow_dispatch_candidate_selected",
  "payment_initiated",
  "payment_authorized",
  "payment_captured",
  "payment_refunded",
  "commission_calculated",
  "payout_scheduled",
  "payout_completed",
  "billing_state_changed",
  "invoice_issued",
]);
export type CaseEventType = z.infer<typeof CaseEventTypeSchema>;

export const CaseEventToneSchema = z.enum([
  "accent",
  "neutral",
  "success",
  "warning",
  "critical",
  "info",
]);
export type CaseEventTone = z.infer<typeof CaseEventToneSchema>;

export const CaseEventActorRoleSchema = z.enum([
  "customer",
  "technician",
  "admin",
  "system",
]);
export type CaseEventActorRole = z.infer<typeof CaseEventActorRoleSchema>;

export const CaseEventItemSchema = z.object({
  id: z.string().uuid(),
  type: CaseEventTypeSchema,
  title: z.string(),
  body: z.string().nullable().optional(),
  tone: CaseEventToneSchema,
  actor_user_id: z.string().uuid().nullable().optional(),
  actor_role: CaseEventActorRoleSchema.nullable().optional(),
  context: z.record(z.unknown()),
  created_at: z.string(),
});
export type CaseEventItem = z.infer<typeof CaseEventItemSchema>;

export const CaseEventListResponseSchema = z.object({
  items: z.array(CaseEventItemSchema),
  next_cursor: z.string().nullable().optional(),
});
export type CaseEventListResponse = z.infer<
  typeof CaseEventListResponseSchema
>;
