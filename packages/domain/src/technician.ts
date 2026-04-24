import { z } from "zod";

import { ProviderModeSchema } from "./shell-config";
import {
  BrandCoverageSchema,
  DistrictRefSchema,
  DrivetrainSchema,
  ProcedureBindingSchema,
  ServiceDomainSchema,
} from "./taxonomy";
import {
  ProviderTypeSchema,
  TechnicianCapabilitySchema,
  TechnicianCertificateKindSchema,
  TechnicianCertificateStatusSchema,
  TechnicianVerifiedLevelSchema,
} from "./user";

/** Coğrafi koordinat. */
export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

/** Haftalık çalışma slot'u. 0=Pzt, 6=Pzr. slot_order öğle arası gibi bölünmüş açılışlar için. */
export const ScheduleSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open_time: z.string().nullable().default(null),
  close_time: z.string().nullable().default(null),
  is_closed: z.boolean().default(false),
  slot_order: z.number().int().min(0).default(0),
});
export type ScheduleSlot = z.infer<typeof ScheduleSlotSchema>;

export const WeeklyScheduleSchema = z.object({
  slots: z.array(ScheduleSlotSchema).default([]),
});
export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;

/** Boyut 1 + 2: ne yapıyor, hangi araca. */
export const TechnicianCoverageSchema = z.object({
  service_domains: z.array(ServiceDomainSchema).default([]),
  procedures: z.array(ProcedureBindingSchema).default([]),
  procedure_tags: z.array(z.string()).default([]),
  brand_coverage: z.array(BrandCoverageSchema).default([]),
  drivetrain_coverage: z.array(DrivetrainSchema).default([]),
});
export type TechnicianCoverage = z.infer<typeof TechnicianCoverageSchema>;

/** Boyut 3: nerede. */
export const ServiceAreaSchema = z.object({
  workshop_lat_lng: LatLngSchema.nullable().default(null),
  service_radius_km: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(15),
  city_code: z.string().nullable().default(null),
  primary_district_id: z.string().nullable().default(null),
  working_districts: z.array(DistrictRefSchema).default([]),
  workshop_address: z.string().nullable().default(null),
  mobile_unit_count: z.number().int().min(0).default(0),
});
export type ServiceArea = z.infer<typeof ServiceAreaSchema>;

/** Boyut 4: kapasite & yan özellikler. Capabilities (4 boolean) ayrı şemada (user.ts). */
export const StaffCapacitySchema = z.object({
  staff_count: z.number().int().min(1).max(50).default(1),
  max_concurrent_jobs: z.number().int().min(1).max(100).default(3),
  night_service: z.boolean().default(false),
  weekend_service: z.boolean().default(false),
  emergency_service: z.boolean().default(false),
  current_queue_depth: z.number().int().min(0).default(0),
});
export type StaffCapacity = z.infer<typeof StaffCapacitySchema>;

/** Boyut 5: performance snapshot — rolling aggregation penceresi. */
export const PerformanceSnapshotSchema = z.object({
  window_days: z.number().int(),
  snapshot_at: z.string(),
  completed_jobs: z.number().int().min(0).default(0),
  rating_bayesian: z.number().min(0).max(5).nullable().default(null),
  rating_count: z.number().int().min(0).default(0),
  response_time_p50_minutes: z.number().int().min(0).nullable().default(null),
  on_time_rate: z.number().min(0).max(1).nullable().default(null),
  cancellation_rate: z.number().min(0).max(1).nullable().default(null),
  dispute_rate: z.number().min(0).max(1).nullable().default(null),
  warranty_honor_rate: z.number().min(0).max(1).nullable().default(null),
  evidence_discipline_score: z.number().min(0).max(1).nullable().default(null),
  hidden_cost_rate: z.number().min(0).max(1).nullable().default(null),
  market_band_percentile: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .default(null),
});
export type PerformanceSnapshot = z.infer<typeof PerformanceSnapshotSchema>;

export const EMPTY_COVERAGE: TechnicianCoverage = {
  service_domains: [],
  procedures: [],
  procedure_tags: [],
  brand_coverage: [],
  drivetrain_coverage: [],
};

export const EMPTY_SERVICE_AREA: ServiceArea = {
  workshop_lat_lng: null,
  service_radius_km: 15,
  city_code: null,
  primary_district_id: null,
  working_districts: [],
  workshop_address: null,
  mobile_unit_count: 0,
};

export const EMPTY_SCHEDULE: WeeklySchedule = { slots: [] };

export const DEFAULT_CAPACITY: StaffCapacity = {
  staff_count: 1,
  max_concurrent_jobs: 3,
  night_service: false,
  weekend_service: false,
  emergency_service: false,
  current_queue_depth: 0,
};

// ─── /technicians/me HTTP shape'ler (BE Pydantic parity) ────────────────────
//
// Mobile profile-store'u bu schema'larla hydrate olur — login sonrası
// backend'den gelen gerçek teknisyen verisi store'a yazılır, fixture
// INITIAL_TECHNICIAN_PROFILE yalnızca seed default'ları olur.

export const TechnicianAvailabilitySchema = z.enum([
  "available",
  "busy",
  "offline",
]);
export type TechnicianAvailability = z.infer<typeof TechnicianAvailabilitySchema>;

/**
 * GET /technicians/me/profile response.
 * Backend: `TechnicianProfileResponse` (routes/technicians.py:85).
 */
export const MyTechnicianProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  tagline: z.string().nullable(),
  biography: z.string().nullable(),
  availability: TechnicianAvailabilitySchema,
  verified_level: TechnicianVerifiedLevelSchema,
  provider_type: ProviderTypeSchema,
  secondary_provider_types: z.array(ProviderTypeSchema).default([]),
  provider_mode: ProviderModeSchema,
  active_provider_type: ProviderTypeSchema.nullable(),
  role_config_version: z.number().int(),
  business_info: z.record(z.string(), z.unknown()).default({}),
  avatar_asset_id: z.string().uuid().nullable(),
  promo_video_asset_id: z.string().uuid().nullable(),
  capability: TechnicianCapabilitySchema.nullable(),
});
export type MyTechnicianProfile = z.infer<typeof MyTechnicianProfileSchema>;

/**
 * GET /technicians/me/certificates response (liste elemanı).
 * Backend: `TechnicianCertificateResponse` (routes/technicians.py:106).
 *
 * Not: Bu shape fixture'daki `TechnicianCertificateSchema`'dan (user.ts)
 * farklıdır — fixture UI-local shape (technician_id, file_url zorunlu),
 * bu ise BE response shape (profile_id, media_asset_id opsiyonel).
 */
export const MyTechnicianCertificateSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  kind: TechnicianCertificateKindSchema,
  title: z.string(),
  status: TechnicianCertificateStatusSchema,
  media_asset_id: z.string().uuid().nullable(),
  uploaded_at: z.string(),
  verified_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  reviewer_note: z.string().nullable(),
});
export type MyTechnicianCertificate = z.infer<typeof MyTechnicianCertificateSchema>;
