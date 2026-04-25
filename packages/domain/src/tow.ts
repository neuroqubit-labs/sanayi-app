import { z } from "zod";

import { LatLngSchema } from "./technician";

// ───────── Enums ─────────

export const TowServiceModeSchema = z.enum(["immediate", "scheduled"]);
export type TowServiceMode = z.infer<typeof TowServiceModeSchema>;

export const TowVehicleEquipmentSchema = z.enum([
  "flatbed",
  "hook",
  "wheel_lift",
  "heavy_duty",
  "motorcycle",
]);
export type TowVehicleEquipment = z.infer<typeof TowVehicleEquipmentSchema>;

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

// Canonical BE (tow-priority audit 2026-04-23 P1-4 + matching-audit P2-2):
// preauth_failed + preauth_stale değerleri shared domain'e eklendi.
export const TowDispatchStageSchema = z.enum([
  "payment_required",
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
  "final_charged",
  "refunded",
  "cancelled",
]);
export type TowSettlementStatus = z.infer<typeof TowSettlementStatusSchema>;

// ───────── Value objects ─────────

export const TowFareQuoteSchema = z.object({
  mode: TowServiceModeSchema,
  base_amount: z.number(),
  distance_km: z.number(),
  per_km_rate: z.number(),
  urgency_surcharge: z.number(),
  buffer_pct: z.number(),
  cap_amount: z.number(),
  locked_price: z.number().nullable().default(null),
  currency: z.string().default("TRY"),
});
export type TowFareQuote = z.infer<typeof TowFareQuoteSchema>;

export const TowLiveLocationSchema = z.object({
  case_id: z.string(),
  technician_id: z.string(),
  lat: z.number(),
  lng: z.number(),
  heading: z.number().nullable().default(null),
  speed_kmh: z.number().nullable().default(null),
  captured_at: z.string(),
});
export type TowLiveLocation = z.infer<typeof TowLiveLocationSchema>;

export const TowKaskoDeclarationSchema = z.object({
  has_kasko: z.boolean().default(false),
  insurer_name: z.string().optional(),
  policy_number: z.string().optional(),
  pre_auth_on_customer_card: z.boolean().default(true),
});
export type TowKaskoDeclaration = z.infer<typeof TowKaskoDeclarationSchema>;

export const TowDispatchAttemptSchema = z.object({
  id: z.string(),
  technician_id: z.string(),
  technician_name: z.string(),
  attempt_order: z.number().int(),
  sent_at: z.string(),
  response_at: z.string().nullable().default(null),
  response: z.enum(["pending", "accepted", "declined", "timeout"]).default("pending"),
  distance_km: z.number(),
  eta_minutes: z.number().int(),
});
export type TowDispatchAttempt = z.infer<typeof TowDispatchAttemptSchema>;

export const TowTechnicianProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number(),
  completed_jobs: z.number().int(),
  plate: z.string(),
  truck_model: z.string(),
  equipment: TowVehicleEquipmentSchema,
  phone: z.string(),
  photo_url: z.string().nullable().default(null),
});
export type TowTechnicianProfile = z.infer<typeof TowTechnicianProfileSchema>;

export const TowBidSchema = z.object({
  id: z.string(),
  technician: TowTechnicianProfileSchema,
  price_amount: z.number(),
  price_label: z.string(),
  eta_window_label: z.string(),
  equipment: TowVehicleEquipmentSchema,
  guarantee_label: z.string().nullable().default(null),
  submitted_at: z.string(),
});
export type TowBid = z.infer<typeof TowBidSchema>;

export const TowEvidenceKindSchema = z.enum([
  "customer_pre_state",
  "tech_arrival",
  "tech_loading",
  "tech_delivery",
]);
export type TowEvidenceKind = z.infer<typeof TowEvidenceKindSchema>;

export const TowEvidenceSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  kind: TowEvidenceKindSchema,
  uploader: z.enum(["customer", "technician", "system"]),
  photo_url: z.string(),
  caption: z.string().nullable().default(null),
  created_at: z.string(),
});
export type TowEvidence = z.infer<typeof TowEvidenceSchema>;

export const TowOtpChallengeSchema = z.object({
  code: z.string(),
  purpose: z.enum(["arrival", "delivery"]),
  recipient: z.enum(["customer", "delivery_recipient"]),
  issued_at: z.string(),
  expires_at: z.string(),
  verified_at: z.string().nullable().default(null),
});
export type TowOtpChallenge = z.infer<typeof TowOtpChallengeSchema>;

// ───────── Request draft ─────────

export const TowRequestSchema = z.object({
  mode: TowServiceModeSchema,
  pickup_lat_lng: LatLngSchema.nullable().default(null),
  pickup_label: z.string(),
  dropoff_lat_lng: LatLngSchema.nullable().default(null),
  dropoff_label: z.string().nullable().default(null),
  vehicle_id: z.string(),
  incident_reason: TowIncidentReasonSchema,
  required_equipment: TowVehicleEquipmentSchema,
  scheduled_at: z.string().nullable().default(null),
  fare_quote: TowFareQuoteSchema,
  kasko: TowKaskoDeclarationSchema.default({
    has_kasko: false,
    pre_auth_on_customer_card: true,
  }),
  attachments: z.array(z.string()).default([]),
});
export type TowRequest = z.infer<typeof TowRequestSchema>;

// ───────── Case snapshot (mock/runtime) ─────────

export const TowCaseSnapshotSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  request: TowRequestSchema,
  stage: TowDispatchStageSchema,
  assigned_technician: TowTechnicianProfileSchema.nullable().default(null),
  current_location: LatLngSchema.nullable().default(null),
  route_points: z.array(LatLngSchema).default([]),
  eta_minutes: z.number().int().nullable().default(null),
  dispatch_attempts: z.array(TowDispatchAttemptSchema).default([]),
  bids: z.array(TowBidSchema).default([]),
  accepted_bid_id: z.string().nullable().default(null),
  evidence: z.array(TowEvidenceSchema).default([]),
  otp_challenges: z.array(TowOtpChallengeSchema).default([]),
  settlement_status: TowSettlementStatusSchema.default("none"),
  final_amount: z.number().nullable().default(null),
  cancellation_reason: z.string().nullable().default(null),
  cancellation_fee: z.number().nullable().default(null),
  rating: z.number().nullable().default(null),
  review_note: z.string().nullable().default(null),
});
export type TowCaseSnapshot = z.infer<typeof TowCaseSnapshotSchema>;

// ───────── Helpers ─────────

export function computeTowCap(input: {
  base: number;
  distance_km: number;
  per_km: number;
  urgency_surcharge: number;
  buffer_pct: number;
}): number {
  const raw =
    input.base + input.distance_km * input.per_km + input.urgency_surcharge;
  return Math.round(raw * (1 + input.buffer_pct));
}

export function computeTowCancellationFee(
  mode: TowServiceMode,
  stage: TowDispatchStage,
): number {
  if (mode === "immediate") {
    if (stage === "searching") return 0;
    if (stage === "accepted" || stage === "en_route" || stage === "nearby")
      return 75;
    if (stage === "arrived") return 300;
    if (stage === "loading" || stage === "in_transit") return -1; // full fare
    return 0;
  }
  // scheduled — gerçek hesap için schedule_at - now farkı gerekir,
  // mock için bucket bazlı varsayılan:
  if (stage === "bidding_open" || stage === "scheduled_waiting") return 0;
  if (stage === "accepted" || stage === "en_route") return 150;
  if (stage === "arrived") return -1;
  return 0;
}

export const TOW_DEFAULT_QUOTE_PARAMS = {
  base: 950,
  per_km: 70,
  urgency_surcharge: 80,
  buffer_pct: 0.1,
} as const;
