import { z } from "zod";

/**
 * Zod ↔ Pydantic parity — naro-backend/app/schemas/technician_public.py.
 * Mobil-backend wire-up brief §PR-A3.
 *
 * PII MASK invariant (I-9): phone/email/legal_name/tax_number/iban
 * response'ta YOKTUR — Zod schema da whitelist'li; unknown field reject.
 */

export const ProviderTypeSchema = z.enum([
  "towing",
  "motorcycle",
  "mechanic",
  "body",
  "glass",
  "tire",
  "battery",
  "parts",
  "detailing",
  "electrical",
  "diagnostic",
  "specialty",
  "other",
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const ProviderModeSchema = z.enum(["business", "individual"]);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

export const TechnicianVerifiedLevelSchema = z.enum([
  "basic",
  "verified",
  "premium",
]);
export type TechnicianVerifiedLevel = z.infer<
  typeof TechnicianVerifiedLevelSchema
>;

export const LocationSummarySchema = z.object({
  city_code: z.string().nullable().optional(),
  city_label: z.string().nullable().optional(),
  primary_district_label: z.string().nullable().optional(),
  service_radius_km: z.number().int().nullable().optional(),
});
export type LocationSummary = z.infer<typeof LocationSummarySchema>;

export const TechnicianPublicViewSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  tagline: z.string().nullable(),
  biography: z.string().nullable(),
  avatar_asset_id: z.string().uuid().nullable(),
  verified_level: TechnicianVerifiedLevelSchema,
  provider_type: ProviderTypeSchema,
  secondary_provider_types: z.array(ProviderTypeSchema),
  active_provider_type: ProviderTypeSchema.nullable(),
  provider_mode: ProviderModeSchema,
  accepting_new_jobs: z.boolean(),
  rating_bayesian: z.number().nullable().default(null),
  rating_count: z.number().int().default(0),
  completed_jobs_30d: z.number().int().default(0),
  response_time_p50_minutes: z.number().int().nullable().default(null),
  location_summary: LocationSummarySchema.default({}),
});
export type TechnicianPublicView = z.infer<typeof TechnicianPublicViewSchema>;

export const TechnicianFeedItemSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  tagline: z.string().nullable(),
  avatar_asset_id: z.string().uuid().nullable(),
  verified_level: TechnicianVerifiedLevelSchema,
  provider_type: ProviderTypeSchema,
  secondary_provider_types: z.array(ProviderTypeSchema),
  active_provider_type: ProviderTypeSchema.nullable(),
  accepting_new_jobs: z.boolean(),
  rating_bayesian: z.number().nullable().default(null),
  rating_count: z.number().int().default(0),
  completed_jobs_30d: z.number().int().default(0),
  location_summary: LocationSummarySchema.default({}),
});
export type TechnicianFeedItem = z.infer<typeof TechnicianFeedItemSchema>;

export const TechnicianFeedResponseSchema = z.object({
  items: z.array(TechnicianFeedItemSchema),
  next_cursor: z.string().nullable(),
});
export type TechnicianFeedResponse = z.infer<typeof TechnicianFeedResponseSchema>;
