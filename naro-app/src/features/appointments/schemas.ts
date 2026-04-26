import { z } from "zod";

/**
 * Appointment canonical schemas — BE app/schemas/appointment.py.
 *
 * Endpoint'ler (customer scope):
 * - POST   /appointments                  (offer-based appointment request)
 * - GET    /appointments/case/{case_id}
 * - POST   /appointments/{id}/cancel      (customer)
 * - POST   /appointments/{id}/confirm-counter
 * - POST   /appointments/{id}/decline-counter
 *
 * Teknisyen tarafı (service app): approve + decline + counter-propose.
 */

export const AppointmentStatusSchema = z.enum([
  "pending",
  "approved",
  "declined",
  "expired",
  "cancelled",
  "counter_pending",
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const AppointmentSourceSchema = z.enum([
  "offer_accept",
  "direct_request",
  "counter",
]);
export type AppointmentSource = z.infer<typeof AppointmentSourceSchema>;

export const AppointmentSlotKindSchema = z.enum([
  "today",
  "tomorrow",
  "custom",
  "flexible",
]);
export type AppointmentSlotKind = z.infer<typeof AppointmentSlotKindSchema>;

/** Mobil camelCase payload (BE # noqa: N815 ile kabul ediyor). */
export const AppointmentSlotSchema = z.object({
  kind: AppointmentSlotKindSchema,
  dateLabel: z.string().nullable().optional(),
  timeWindow: z.string().nullable().optional(),
});
export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>;

// ─── Request bodies ────────────────────────────────────────────────────────

/**
 * Canonical backend AppointmentRequest.
 * Vaka omurgası refactor: bakım/arıza/hasar randevusu teklif olmadan
 * oluşturulmaz. FE `offer_id` gönderir; BE `expires_at/source` defaultlarını
 * güvenli şekilde üretir.
 */
export const AppointmentRequestPayloadSchema = z.object({
  case_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  offer_id: z.string().uuid(),
  slot: AppointmentSlotSchema,
  note: z.string().default(""),
});
export type AppointmentRequestPayload = z.infer<
  typeof AppointmentRequestPayloadSchema
>;

export const AppointmentDeclineRequestSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type AppointmentDeclineRequest = z.infer<
  typeof AppointmentDeclineRequestSchema
>;

// ─── Response ──────────────────────────────────────────────────────────────

export const AppointmentResponseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  offer_id: z.string().uuid().nullable(),
  slot: z.record(z.unknown()),
  slot_kind: AppointmentSlotKindSchema,
  note: z.string().nullable(),
  status: AppointmentStatusSchema,
  requested_at: z.string(),
  expires_at: z.string(),
  responded_at: z.string().nullable(),
  decline_reason: z.string().nullable(),
  source: AppointmentSourceSchema,
  counter_proposal: z.record(z.unknown()).nullable(),
  counter_proposal_by_user_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AppointmentResponse = z.infer<typeof AppointmentResponseSchema>;
