import { z } from "zod";

/**
 * Offer canonical schemas — BE shipped 0220362 (2026-04-23).
 * Decimal string serialization; BE Pydantic v2 Decimal → "123.45".
 *
 * Endpoint'ler:
 * - POST   /offers (teknisyen submit — customer app consume etmez)
 * - GET    /offers/case/{case_id}
 * - POST   /offers/{id}/accept
 * - POST   /offers/{id}/shortlist
 * - POST   /offers/{id}/reject
 * - POST   /offers/{id}/withdraw (teknisyen)
 */

export const CaseOfferStatusSchema = z.enum([
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
]);
export type CaseOfferStatus = z.infer<typeof CaseOfferStatusSchema>;

/**
 * AppointmentSlot mobil canonical — camelCase field (dateLabel, timeWindow)
 * BE Pydantic `model_config extra=forbid` + `# noqa: N815` ile kabul ediyor.
 */
export const AppointmentSlotSchema = z.object({
  kind: z.enum(["fixed", "window", "immediate", "scheduled"]),
  dateLabel: z.string().nullable().optional(),
  timeWindow: z.string().nullable().optional(),
});
export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>;

/**
 * BE canonical response (api-validation-hotlist 2026-04-23 P0-2): backend
 * datetime alanlarını henüz döndürmüyor; `.parse` crash'ı engellemek için
 * tüm datetime'lar optional. Backend response genişlerse optional'lar
 * doğal olarak dolar. submitted_at/created_at/updated_at UI'da "önce"
 * etiketleri için kullanılıyor; null olursa skip.
 */
export const OfferResponseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  headline: z.string(),
  description: z.string().nullable(),
  amount: z.string(),
  currency: z.string().default("TRY"),
  eta_minutes: z.number().int(),
  delivery_mode: z.string(),
  warranty_label: z.string(),
  available_at_label: z.string().nullable(),
  badges: z.array(z.string()).default([]),
  slot_proposal: z.record(z.unknown()).nullable(),
  slot_is_firm: z.boolean().default(false),
  status: CaseOfferStatusSchema,
  submitted_at: z.string().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  rejected_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type OfferResponse = z.infer<typeof OfferResponseSchema>;
