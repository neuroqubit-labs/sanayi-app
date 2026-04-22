import { z } from "zod";

/**
 * Zod ↔ Pydantic parity — naro-backend/app/schemas/taxonomy.py +
 * naro-backend/app/api/v1/routes/technicians.py (CoveragePayload, inline).
 * Mobil-backend wire-up brief §PR-B parity garantisi.
 */

// ─── Taxonomy read (GET /taxonomy/*) ───────────────────────────────────────

export const ServiceDomainOutSchema = z.object({
  domain_key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  display_order: z.number().int(),
});
export type ServiceDomainOut = z.infer<typeof ServiceDomainOutSchema>;

export const ProcedureOutSchema = z.object({
  procedure_key: z.string(),
  domain_key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  typical_labor_hours_min: z.number().nullable().optional(),
  typical_labor_hours_max: z.number().nullable().optional(),
  typical_parts_cost_min: z.number().nullable().optional(),
  typical_parts_cost_max: z.number().nullable().optional(),
  is_popular: z.boolean(),
  display_order: z.number().int(),
});
export type ProcedureOut = z.infer<typeof ProcedureOutSchema>;

export const BrandTierSchema = z.enum([
  "mass",
  "premium",
  "luxury",
  "commercial",
  "motorcycle",
]);
export type BrandTier = z.infer<typeof BrandTierSchema>;

export const BrandOutSchema = z.object({
  brand_key: z.string(),
  label: z.string(),
  tier: BrandTierSchema,
  country_code: z.string().nullable().optional(),
  display_order: z.number().int(),
});
export type BrandOut = z.infer<typeof BrandOutSchema>;

export const DrivetrainOutSchema = z.object({
  drivetrain_key: z.string(),
  label: z.string(),
  fuel_type: z.string(),
  transmission: z.string().nullable().optional(),
  display_order: z.number().int(),
});
export type DrivetrainOut = z.infer<typeof DrivetrainOutSchema>;

// ─── Coverage write (PUT /technicians/me/coverage) ─────────────────────────

export const ProcedureBindingPayloadSchema = z.object({
  procedure_key: z.string().min(1).max(60),
  confidence_self_declared: z.number().min(0).max(1).default(1),
});
export type ProcedureBindingPayload = z.infer<
  typeof ProcedureBindingPayloadSchema
>;

export const BrandBindingPayloadSchema = z.object({
  brand_key: z.string().min(1).max(40),
  is_authorized: z.boolean().default(false),
  is_premium_authorized: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});
export type BrandBindingPayload = z.infer<typeof BrandBindingPayloadSchema>;

export const CoveragePayloadSchema = z.object({
  service_domains: z.array(z.string()),
  procedures: z.array(ProcedureBindingPayloadSchema),
  procedure_tags: z.array(z.string().min(1).max(120)),
  brand_coverage: z.array(BrandBindingPayloadSchema),
  drivetrain_coverage: z.array(z.string()),
});
export type CoveragePayload = z.infer<typeof CoveragePayloadSchema>;

export const CoverageSnapshotResponseSchema = z.object({
  service_domains: z.array(z.string()),
  procedures: z.array(z.string()),
  procedure_tags: z.array(z.string()),
  brand_coverage: z.array(z.string()),
  drivetrain_coverage: z.array(z.string()),
});
export type CoverageSnapshotResponse = z.infer<
  typeof CoverageSnapshotResponseSchema
>;

// ─── Admission gate validation ─────────────────────────────────────────────

export const COVERAGE_ADMISSION_RULES = {
  minDomains: 1,
  minProcedures: 1,
  minBrands: 1,
  minDrivetrains: 1,
} as const;

export function validateCoverageAdmission(
  coverage: Pick<
    CoveragePayload,
    "service_domains" | "procedures" | "brand_coverage" | "drivetrain_coverage"
  >,
  options: { allBrandsOptIn?: boolean } = {},
): string | null {
  if (coverage.service_domains.length < COVERAGE_ADMISSION_RULES.minDomains) {
    return "En az bir uzmanlık alanı seç.";
  }
  if (coverage.procedures.length < COVERAGE_ADMISSION_RULES.minProcedures) {
    return "Seçilen alanlarda en az bir işlem seç.";
  }
  if (
    !options.allBrandsOptIn &&
    coverage.brand_coverage.length < COVERAGE_ADMISSION_RULES.minBrands
  ) {
    return "En az bir marka seç veya 'Tüm markalar' opt-out'u aç.";
  }
  if (
    coverage.drivetrain_coverage.length <
    COVERAGE_ADMISSION_RULES.minDrivetrains
  ) {
    return "En az bir motor tipi seç.";
  }
  return null;
}
