import { z } from "zod";

/**
 * Tow canonical schemas — BE parity app/schemas/tow.py.
 * Customer scope (compose/snapshot/tracking/cancel/OTP/rating).
 * Tech-side (dispatch/location/evidence) service app'te.
 *
 * Decimal serialization: BE Pydantic v2 Decimal → string; Zod number()
 * (float) ya da string() seçimi field-by-field.
 */

export const TowModeSchema = z.enum(["immediate", "scheduled"]);
export type TowMode = z.infer<typeof TowModeSchema>;

export const TowEquipmentSchema = z.enum([
  "flatbed",
  "hook",
  "wheel_lift",
  "heavy_duty",
  "motorcycle",
]);
export type TowEquipment = z.infer<typeof TowEquipmentSchema>;

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

// ─── Primitives ────────────────────────────────────────────────────────────

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

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

export const TowKaskoDeclarationSchema = z.object({
  has_kasko: z.boolean().default(false),
  insurer_name: z.string().nullable().optional(),
  policy_number: z.string().nullable().optional(),
  pre_auth_on_customer_card: z.boolean().default(true),
});
export type TowKaskoDeclaration = z.infer<typeof TowKaskoDeclarationSchema>;

// ─── Request payloads ──────────────────────────────────────────────────────

export const TowFareQuoteRequestSchema = z.object({
  mode: TowModeSchema,
  pickup_lat_lng: LatLngSchema,
  dropoff_lat_lng: LatLngSchema.nullable().optional(),
  required_equipment: z.array(TowEquipmentSchema).default([]),
  urgency_bump: z.boolean().default(false),
});
export type TowFareQuoteRequest = z.infer<typeof TowFareQuoteRequestSchema>;

export const TowFareQuoteResponseSchema = z.object({
  quote: TowFareQuoteSchema,
  pickup_address: z.string().nullable().optional(),
  dropoff_address: z.string().nullable().optional(),
  distance_km: z.string(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  distance_source: z.enum(["google", "haversine"]).optional(),
  route_coords: z.array(LatLngSchema).nullable().optional(),
  expires_at: z.string(),
});
export type TowFareQuoteResponse = z.infer<typeof TowFareQuoteResponseSchema>;

export const TowCreateCaseRequestSchema = z.object({
  mode: TowModeSchema,
  pickup_lat_lng: LatLngSchema,
  pickup_label: z.string(),
  dropoff_lat_lng: LatLngSchema.nullable().optional(),
  dropoff_label: z.string().nullable().optional(),
  vehicle_id: z.string().uuid(),
  incident_reason: TowIncidentReasonSchema,
  required_equipment: z.array(TowEquipmentSchema).default([]),
  scheduled_at: z.string().nullable().optional(),
  fare_quote: TowFareQuoteSchema,
  kasko: TowKaskoDeclarationSchema.default({
    has_kasko: false,
    pre_auth_on_customer_card: true,
  }),
  attachments: z.array(z.string().uuid()).default([]),
  /**
   * BE Faz 2 (2026-04-23): accident/breakdown parent'ı (opsiyonel).
   * BE validate eder: owned + accident/breakdown kind + not deleted.
   */
  parent_case_id: z.string().uuid().nullable().optional(),
});
export type TowCreateCaseRequest = z.infer<typeof TowCreateCaseRequestSchema>;

export const TowCancelInputSchema = z.object({
  reason_code: z.string(),
  reason_note: z.string().nullable().optional(),
});
export type TowCancelInput = z.infer<typeof TowCancelInputSchema>;

export const TowOtpVerifyInputSchema = z.object({
  purpose: z.enum(["arrival", "delivery"]),
  code: z.string().min(4).max(8),
});
export type TowOtpVerifyInput = z.infer<typeof TowOtpVerifyInputSchema>;

export const TowRatingInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review_note: z.string().nullable().optional(),
});
export type TowRatingInput = z.infer<typeof TowRatingInputSchema>;

// ─── Response payloads ─────────────────────────────────────────────────────

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

export const TowOtpChallengeSchema = z.object({
  purpose: z.enum(["arrival", "delivery"]),
  expires_at: z.string(),
  delivered_to: z.string().nullable().optional(),
});
export type TowOtpChallenge = z.infer<typeof TowOtpChallengeSchema>;
