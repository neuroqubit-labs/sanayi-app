import type {
  BrandCoverage,
  Drivetrain,
  MediaAsset,
  PerformanceSnapshot,
  ProcedureBinding,
  ProviderMode,
  ProviderType,
  ServiceArea,
  ServiceDomain,
  StaffCapacity,
  TechnicianCapability,
  TechnicianCertificate,
  TechnicianVerifiedLevel,
  WeeklySchedule,
} from "@naro/domain";
import { MediaAssetSchema } from "@naro/domain";
import { z } from "zod";

export const BusinessInfoSchema = z.object({
  legal_name: z.string(),
  tax_number: z.string().optional(),
  address: z.string(),
  city_district: z.string().optional(),
  iban: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});
export type BusinessInfo = z.infer<typeof BusinessInfoSchema>;

export const GalleryItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["photo", "video"]),
  title: z.string().optional(),
  caption: z.string().optional(),
  asset: MediaAssetSchema.nullable().default(null),
});
export type GalleryItem = z.infer<typeof GalleryItemSchema>;

export type TechnicianProfileState = {
  name: string;
  tagline: string;
  biography: string;
  availability: "available" | "busy" | "offline";
  verified_level: TechnicianVerifiedLevel;
  provider_type: ProviderType;
  secondary_provider_types: ProviderType[];
  provider_mode: ProviderMode;
  active_provider_type: ProviderType | null;
  role_config_version: number;
  business: BusinessInfo;
  /** @deprecated Use `working_schedule` instead. Kept for backward compatibility. */
  working_hours: string;
  /** @deprecated Use `service_area.workshop_address` + primary district. */
  area_label: string;
  /** @deprecated Use `coverage.procedure_tags` or `coverage.service_domains` instead. */
  specialties: string[];
  /** @deprecated Use `coverage.procedures` with typed procedure keys. */
  expertise: string[];
  capabilities: TechnicianCapability;
  certificates: TechnicianCertificate[];
  gallery: GalleryItem[];
  avatar_asset?: MediaAsset | null;
  promo_video_url?: string;
  promo_video_asset?: MediaAsset | null;

  // V2 — yapısal sinyaller
  service_domains: ServiceDomain[];
  procedures: ProcedureBinding[];
  procedure_tags: string[];
  brand_coverage: BrandCoverage[];
  drivetrain_coverage: Drivetrain[];
  service_area: ServiceArea;
  working_schedule: WeeklySchedule;
  capacity: StaffCapacity;
  latest_performance: PerformanceSnapshot | null;
};
