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
