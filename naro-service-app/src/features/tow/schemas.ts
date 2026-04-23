import { z } from "zod";

/**
 * Service app tow canonical schemas — BE parity app/schemas/tow.py.
 * Customer app'takiyle aynı canonical; ayrı dosya çünkü service-side
 * scope (accept/decline/OTP issue/evidence).
 */

export const TowEquipmentSchema = z.enum([
  "flatbed",
  "hook",
  "wheel_lift",
  "heavy_duty",
  "motorcycle",
]);
export type TowEquipment = z.infer<typeof TowEquipmentSchema>;

export const TowDispatchResponseSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "timeout",
]);
export type TowDispatchResponse = z.infer<typeof TowDispatchResponseSchema>;

export const TowDispatchStageSchema = z.enum([
  "searching",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "loading",
  "in_transit",
  "delivered",
  "cancelled",
  "timeout_converted_to_pool",
  "scheduled_waiting",
  "bidding_open",
  "offer_accepted",
  "preauth_failed",
  "preauth_stale",
]);
export type TowDispatchStage = z.infer<typeof TowDispatchStageSchema>;

export const TowEvidenceKindSchema = z.enum([
  "customer_pre_state",
  "tech_arrival",
  "tech_loading",
  "tech_delivery",
]);
export type TowEvidenceKind = z.infer<typeof TowEvidenceKindSchema>;

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

// ─── Request payloads ──────────────────────────────────────────────────────

export const TowDispatchResponseInputSchema = z.object({
  attempt_id: z.string().uuid(),
  response: z.enum(["accepted", "declined"]),
  rejection_reason: z.string().nullable().optional(),
});
export type TowDispatchResponseInput = z.infer<
  typeof TowDispatchResponseInputSchema
>;

export const TowOtpIssueInputSchema = z.object({
  purpose: z.enum(["arrival", "delivery"]),
  recipient: z.enum(["customer", "delivery_person"]),
});
export type TowOtpIssueInput = z.infer<typeof TowOtpIssueInputSchema>;

export const TowOtpVerifyInputSchema = z.object({
  purpose: z.enum(["arrival", "delivery"]),
  code: z.string().min(4).max(8),
});
export type TowOtpVerifyInput = z.infer<typeof TowOtpVerifyInputSchema>;

// ─── Response payloads ─────────────────────────────────────────────────────

export const TowDispatchResponseOutputSchema = z.object({
  attempt_id: z.string().uuid(),
  response: TowDispatchResponseSchema,
  next_stage: TowDispatchStageSchema.nullable(),
});
export type TowDispatchResponseOutput = z.infer<
  typeof TowDispatchResponseOutputSchema
>;

export const TowOtpChallengeSchema = z.object({
  purpose: z.enum(["arrival", "delivery"]),
  expires_at: z.string(),
  delivered_to: z.string().nullable().optional(),
});
export type TowOtpChallenge = z.infer<typeof TowOtpChallengeSchema>;

export const TowEvidenceOutSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  kind: TowEvidenceKindSchema,
  media_asset_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type TowEvidenceOut = z.infer<typeof TowEvidenceOutSchema>;

// ─── Snapshot + tracking (teknisyen tarafı aynı BE endpoint) ───────────────

export const TowModeSchema = z.enum(["immediate", "scheduled"]);
export type TowMode = z.infer<typeof TowModeSchema>;

export const TowIncidentReasonSchema = z.enum([
  "not_running",
  "accident",
  "flat_tire",
  "battery",
  "fuel",
  "locked_keys",
  "stuck",
  "other",
]);
export type TowIncidentReason = z.infer<typeof TowIncidentReasonSchema>;

export const TowSettlementStatusSchema = z.enum([
  "none",
  "pre_auth_holding",
  "preauth_stale",
  "final_charged",
  "refunded",
  "cancelled",
  "kasko_rejected",
]);
export type TowSettlementStatus = z.infer<typeof TowSettlementStatusSchema>;

export const TowFareQuoteSchema = z.object({
  mode: TowModeSchema,
  base_amount: z.string(),
  distance_km: z.string(),
  per_km_rate: z.string(),
  urgency_surcharge: z.string(),
  buffer_pct: z.string(),
  cap_amount: z.string(),
  locked_price: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
});
export type TowFareQuote = z.infer<typeof TowFareQuoteSchema>;

export const TowCaseSnapshotSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  mode: TowModeSchema,
  stage: TowDispatchStageSchema,
  status: z.string(),
  pickup_lat_lng: LatLngSchema.nullable(),
  pickup_label: z.string().nullable(),
  dropoff_lat_lng: LatLngSchema.nullable(),
  dropoff_label: z.string().nullable(),
  incident_reason: TowIncidentReasonSchema.nullable(),
  required_equipment: z.array(TowEquipmentSchema).default([]),
  scheduled_at: z.string().nullable(),
  fare_quote: TowFareQuoteSchema.nullable(),
  assigned_technician_id: z.string().uuid().nullable(),
  settlement_status: TowSettlementStatusSchema,
  final_amount: z.string().nullable(),
  cancellation_fee: z.string().nullable(),
});
export type TowCaseSnapshot = z.infer<typeof TowCaseSnapshotSchema>;

export const TowTrackingSnapshotSchema = z.object({
  case_id: z.string().uuid(),
  stage: TowDispatchStageSchema,
  technician_id: z.string().uuid().nullable(),
  last_location: LatLngSchema.nullable(),
  last_location_at: z.string().nullable(),
  eta_minutes: z.number().int().nullable(),
  updated_at: z.string(),
});
export type TowTrackingSnapshot = z.infer<typeof TowTrackingSnapshotSchema>;
