import { z } from "zod";

/**
 * Service app jobs canonical schemas — BE parity (app/schemas/pool.py +
 * offer.py + appointment.py). P1-4 launch migration 2026-04-23.
 *
 * Mock jobs API/store `*.mock.ts` altında karantinadadır. Yeni tüketiciler
 * bu dosya + api.live.ts facade'ını kullanır.
 */

export const ServiceRequestKindSchema = z.enum([
  "accident",
  "breakdown",
  "maintenance",
  "towing",
]);
export type ServiceRequestKind = z.infer<typeof ServiceRequestKindSchema>;

export const ServiceRequestUrgencySchema = z.enum([
  "planned",
  "today",
  "urgent",
]);
export type ServiceRequestUrgency = z.infer<
  typeof ServiceRequestUrgencySchema
>;

export const ServiceCaseStatusSchema = z.enum([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
  "completed",
  "cancelled",
  "archived",
]);
export type ServiceCaseStatus = z.infer<typeof ServiceCaseStatusSchema>;

// ─── /pool/feed + /pool/case/{id} ──────────────────────────────────────────

export const PoolCaseItemSchema = z.object({
  id: z.string().uuid(),
  kind: ServiceRequestKindSchema,
  urgency: ServiceRequestUrgencySchema,
  status: ServiceCaseStatusSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  location_label: z.string().nullable(),
  created_at: z.string(),
  estimate_amount: z.string().nullable(),
  is_matched_to_me: z.boolean().default(false),
  match_badge: z.string().nullable().optional(),
  match_reason_label: z.string().nullable().optional(),
  is_notified_to_me: z.boolean().default(false),
  has_offer_from_me: z.boolean().default(false),
});
export type PoolCaseItem = z.infer<typeof PoolCaseItemSchema>;

export const PoolCaseDetailSchema = z.object({
  id: z.string().uuid(),
  kind: ServiceRequestKindSchema,
  urgency: ServiceRequestUrgencySchema,
  status: ServiceCaseStatusSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  summary: z.string().nullable(),
  location_label: z.string().nullable(),
  customer_masked_name: z.string(),
  vehicle_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  estimate_amount: z.string().nullable(),
  is_matched_to_me: z.boolean().default(false),
  match_badge: z.string().nullable().optional(),
  match_reason_label: z.string().nullable().optional(),
  is_notified_to_me: z.boolean().default(false),
  has_offer_from_me: z.boolean().default(false),
});
export type PoolCaseDetail = z.infer<typeof PoolCaseDetailSchema>;

export const PaginatedPoolSchema = z.object({
  items: z.array(PoolCaseItemSchema),
  next_cursor: z.string().nullable(),
});
export type PaginatedPool = z.infer<typeof PaginatedPoolSchema>;

// ─── /offers (teknisyen submit) ────────────────────────────────────────────

/**
 * BE OfferSubmit canlı route payload.
 *
 * Not: technician_id FE'den gönderilmez; backend auth token'dan teknisyeni
 * çözer. Eski canonical schema ile route payload bir süre drift ettiğinden
 * service app 422 extra_forbidden alıyordu.
 */
export const OfferSubmitPayloadSchema = z.object({
  case_id: z.string().uuid(),
  headline: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  amount: z.string(),
  currency: z.string().default("TRY"),
  eta_minutes: z.number().int().min(0),
  delivery_mode: z.string().min(1).max(64),
  warranty_label: z.string().min(1).max(128),
  available_at_label: z.string().nullable().optional(),
  badges: z.array(z.string()).default([]).optional(),
  expires_at: z.string().nullable().optional(),
  slot_proposal: z.record(z.unknown()).nullable().optional(),
  slot_is_firm: z.boolean().default(false),
});
export type OfferSubmitPayload = z.infer<typeof OfferSubmitPayloadSchema>;

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
  status: z.enum([
    "pending",
    "shortlisted",
    "accepted",
    "rejected",
    "expired",
    "withdrawn",
  ]),
  submitted_at: z.string().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  rejected_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type OfferResponse = z.infer<typeof OfferResponseSchema>;

// ─── /appointments (teknisyen approve/decline) ─────────────────────────────

export const AppointmentDeclineRequestSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type AppointmentDeclineRequest = z.infer<
  typeof AppointmentDeclineRequestSchema
>;
