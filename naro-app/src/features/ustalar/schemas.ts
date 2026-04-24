import { z } from "zod";

/**
 * Zod ↔ Pydantic parity — naro-backend/app/schemas/technician_public.py.
 * Mobil-backend wire-up brief §PR-A3.
 *
 * PII MASK invariant (I-9): phone/email/legal_name/tax_number/iban
 * response'ta YOKTUR — Zod schema da whitelist'li; unknown field reject.
 */

export const ProviderTypeSchema = z.enum([
  "usta",
  "cekici",
  "oto_aksesuar",
  "kaporta_boya",
  "lastik",
  "oto_elektrik",
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

export const PublicMediaAssetSchema = z.object({
  id: z.string().uuid(),
  purpose: z.string(),
  mime_type: z.string(),
  preview_url: z.string().nullable().optional(),
  thumb_url: z.string().nullable().optional(),
  download_url: z.string().nullable().optional(),
});
export type PublicMediaAsset = z.infer<typeof PublicMediaAssetSchema>;

export const PublicIdentitySummarySchema = z.object({
  display_name: z.string(),
  tagline: z.string().nullable().optional(),
  provider_type: ProviderTypeSchema,
  secondary_provider_types: z.array(ProviderTypeSchema).default([]),
  active_provider_type: ProviderTypeSchema.nullable().optional(),
  provider_mode: ProviderModeSchema,
  avatar_asset_id: z.string().uuid().nullable().optional(),
  avatar_media: PublicMediaAssetSchema.nullable().optional(),
  verified_level: TechnicianVerifiedLevelSchema,
  accepting_new_jobs: z.boolean(),
});
export type PublicIdentitySummary = z.infer<typeof PublicIdentitySummarySchema>;

export const LabelledSignalSchema = z.object({
  key: z.string(),
  label: z.string(),
});
export type LabelledSignal = z.infer<typeof LabelledSignalSchema>;

export const BrandCoverageSignalSchema = LabelledSignalSchema.extend({
  is_authorized: z.boolean().default(false),
  is_premium_authorized: z.boolean().default(false),
});
export type BrandCoverageSignal = z.infer<typeof BrandCoverageSignalSchema>;

export const FitSummarySchema = z.object({
  provider_type: ProviderTypeSchema,
  active_provider_type: ProviderTypeSchema.nullable().optional(),
  service_domains: z.array(LabelledSignalSchema).default([]),
  procedure_tags: z.array(z.string()).default([]),
  brand_coverage: z.array(BrandCoverageSignalSchema).default([]),
});
export type FitSummary = z.infer<typeof FitSummarySchema>;

export const TechnicianCertificateKindSchema = z.enum([
  "identity",
  "tax_registration",
  "trade_registry",
  "insurance",
  "technical",
  "vehicle_license",
  "tow_operator",
]);
export type TechnicianCertificateKind = z.infer<
  typeof TechnicianCertificateKindSchema
>;

export const TrustSummarySchema = z.object({
  rating_bayesian: z.coerce.number().nullable().default(null),
  rating_count: z.number().int().default(0),
  completed_jobs_30d: z.number().int().default(0),
  response_time_p50_minutes: z.number().int().nullable().default(null),
  verified_level: TechnicianVerifiedLevelSchema,
  approved_certificate_count: z.number().int().default(0),
  approved_certificate_kinds: z
    .array(TechnicianCertificateKindSchema)
    .default([]),
});
export type TrustSummary = z.infer<typeof TrustSummarySchema>;

export const ProofPreviewItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["photo", "video"]),
  title: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  media: PublicMediaAssetSchema,
});
export type ProofPreviewItem = z.infer<typeof ProofPreviewItemSchema>;

export const PublicCaseShowcaseMediaSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  title: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  media: PublicMediaAssetSchema,
});
export type PublicCaseShowcaseMedia = z.infer<
  typeof PublicCaseShowcaseMediaSchema
>;

export const PublicCaseShowcasePreviewSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["accident", "towing", "breakdown", "maintenance"]),
  kind_label: z.string(),
  title: z.string(),
  summary: z.string(),
  month_label: z.string().nullable().optional(),
  location_label: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  review_body: z.string().nullable().optional(),
  media: PublicCaseShowcaseMediaSchema.nullable().optional(),
});
export type PublicCaseShowcasePreview = z.infer<
  typeof PublicCaseShowcasePreviewSchema
>;

export const PublicCaseShowcaseDetailSchema =
  PublicCaseShowcasePreviewSchema.extend({
    delivery_report: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .default([]),
    media_items: z.array(PublicCaseShowcaseMediaSchema).default([]),
  });
export type PublicCaseShowcaseDetail = z.infer<
  typeof PublicCaseShowcaseDetailSchema
>;

export const OperationsSummarySchema = z.object({
  location_summary: LocationSummarySchema.default({}),
  area_label: z.string().nullable().optional(),
  working_hours: z.string().nullable().optional(),
  mobile_service: z.boolean().default(false),
  valet_service: z.boolean().default(false),
  on_site_repair: z.boolean().default(false),
  towing_coordination: z.boolean().default(false),
  mobile_unit_count: z.number().int().default(0),
  staff_count: z.number().int().nullable().optional(),
  max_concurrent_jobs: z.number().int().nullable().optional(),
  night_service: z.boolean().default(false),
  weekend_service: z.boolean().default(false),
  emergency_service: z.boolean().default(false),
});
export type OperationsSummary = z.infer<typeof OperationsSummarySchema>;

export const PublicAboutSchema = z.object({
  biography: z.string().nullable().optional(),
  service_note: z.string().nullable().optional(),
});
export type PublicAbout = z.infer<typeof PublicAboutSchema>;

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
  rating_bayesian: z.coerce.number().nullable().default(null),
  rating_count: z.number().int().default(0),
  completed_jobs_30d: z.number().int().default(0),
  response_time_p50_minutes: z.number().int().nullable().default(null),
  location_summary: LocationSummarySchema.default({}),
  identity: PublicIdentitySummarySchema.nullable().optional(),
  fit_summary: FitSummarySchema.nullable().optional(),
  trust_summary: TrustSummarySchema.nullable().optional(),
  proof_preview: z.array(ProofPreviewItemSchema).default([]),
  case_showcases: z.array(PublicCaseShowcasePreviewSchema).default([]),
  operations: OperationsSummarySchema.nullable().optional(),
  about: PublicAboutSchema.nullable().optional(),
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
  rating_bayesian: z.coerce.number().nullable().default(null),
  rating_count: z.number().int().default(0),
  completed_jobs_30d: z.number().int().default(0),
  location_summary: LocationSummarySchema.default({}),
  proof_preview: z.array(ProofPreviewItemSchema).default([]),
  case_showcases: z.array(PublicCaseShowcasePreviewSchema).default([]),
});
export type TechnicianFeedItem = z.infer<typeof TechnicianFeedItemSchema>;

export const TechnicianFeedResponseSchema = z.object({
  items: z.array(TechnicianFeedItemSchema),
  next_cursor: z.string().nullable(),
});
export type TechnicianFeedResponse = z.infer<typeof TechnicianFeedResponseSchema>;

// ─── Taxonomy (filter chip data — backend /taxonomy/*) ─────────────────────

export const ServiceDomainOutSchema = z.object({
  domain_key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  display_order: z.number().int(),
});
export type ServiceDomainOut = z.infer<typeof ServiceDomainOutSchema>;

export const BrandTierSchema = z.enum([
  "mass",
  "premium",
  "luxury",
  "commercial",
  "motorcycle",
]);

export const BrandOutSchema = z.object({
  brand_key: z.string(),
  label: z.string(),
  tier: BrandTierSchema,
  country_code: z.string().nullable().optional(),
  display_order: z.number().int(),
});
export type BrandOut = z.infer<typeof BrandOutSchema>;
