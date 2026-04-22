import { z } from "zod";

/**
 * Zod ↔ Pydantic parity — naro-backend/app/schemas/service_request.py +
 * app/api/v1/routes/cases.py.
 * Mobil-backend wire-up brief §PR-A1.
 */

// ─── Kind-spesifik enum'lar (mobil Zod mirror) ──────────────────────────────

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
export type ServiceRequestUrgency = z.infer<typeof ServiceRequestUrgencySchema>;

export const ServicePickupPreferenceSchema = z.enum([
  "dropoff",
  "pickup",
  "valet",
]);
export type ServicePickupPreference = z.infer<
  typeof ServicePickupPreferenceSchema
>;

export const AccidentReportMethodSchema = z.enum(["e_devlet", "paper", "police"]);
export type AccidentReportMethod = z.infer<typeof AccidentReportMethodSchema>;

export const BreakdownCategorySchema = z.enum([
  "engine",
  "electric",
  "mechanic",
  "climate",
  "transmission",
  "tire",
  "fluid",
  "other",
]);
export type BreakdownCategory = z.infer<typeof BreakdownCategorySchema>;

export const PricePreferenceSchema = z.enum([
  "any",
  "nearby",
  "cheap",
  "fast",
]);
export type PricePreference = z.infer<typeof PricePreferenceSchema>;

export const MaintenanceCategorySchema = z.enum([
  "periodic",
  "tire",
  "glass_film",
  "coating",
  "battery",
  "climate",
  "brake",
  "detail_wash",
  "headlight_polish",
  "engine_wash",
  "package_summer",
  "package_winter",
  "package_new_car",
  "package_sale_prep",
]);
export type MaintenanceCategory = z.infer<typeof MaintenanceCategorySchema>;

export const CaseAttachmentKindSchema = z.enum([
  "photo",
  "video",
  "audio",
  "invoice",
  "report",
  "document",
  "location",
]);
export type CaseAttachmentKind = z.infer<typeof CaseAttachmentKindSchema>;

export const DamageSeveritySchema = z.enum([
  "minor",
  "moderate",
  "major",
  "total_loss",
]);
export type DamageSeverity = z.infer<typeof DamageSeveritySchema>;

export const LatLngPayloadSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLngPayload = z.infer<typeof LatLngPayloadSchema>;

export const CaseAttachmentDraftSchema = z.object({
  id: z.string(),
  kind: CaseAttachmentKindSchema,
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  statusLabel: z.string().nullable().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  category: z.string().max(64).nullable().optional(),
});
export type CaseAttachmentDraft = z.infer<typeof CaseAttachmentDraftSchema>;

// ─── POST /cases body ───────────────────────────────────────────────────────

export const ServiceRequestDraftCreateSchema = z.object({
  schema_version: z.literal("v1").default("v1"),
  kind: ServiceRequestKindSchema,
  vehicle_id: z.string().uuid(),
  urgency: ServiceRequestUrgencySchema,
  summary: z.string().min(1).max(500),
  location_label: z.string().min(1).max(255),
  location_lat_lng: LatLngPayloadSchema.nullable().optional(),
  dropoff_label: z.string().max(255).nullable().optional(),
  dropoff_lat_lng: LatLngPayloadSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  attachments: z.array(CaseAttachmentDraftSchema).default([]),
  symptoms: z.array(z.string()).default([]),
  maintenance_items: z.array(z.string()).default([]),
  preferred_window: z.string().nullable().optional(),
  vehicle_drivable: z.boolean().nullable().optional(),
  towing_required: z.boolean().default(false),
  pickup_preference: ServicePickupPreferenceSchema.nullable().optional(),
  mileage_km: z.number().int().min(0).nullable().optional(),
  preferred_technician_id: z.string().uuid().nullable().optional(),
  // Kaza
  counterparty_note: z.string().nullable().optional(),
  counterparty_vehicle_count: z.number().int().min(0).nullable().optional(),
  damage_area: z.string().nullable().optional(),
  damage_severity: DamageSeveritySchema.nullable().optional(),
  valet_requested: z.boolean().default(false),
  report_method: AccidentReportMethodSchema.nullable().optional(),
  kasko_selected: z.boolean().default(false),
  kasko_brand: z.string().nullable().optional(),
  sigorta_selected: z.boolean().default(false),
  sigorta_brand: z.string().nullable().optional(),
  ambulance_contacted: z.boolean().default(false),
  emergency_acknowledged: z.boolean().default(false),
  // Arıza
  breakdown_category: BreakdownCategorySchema.nullable().optional(),
  on_site_repair: z.boolean().default(false),
  price_preference: PricePreferenceSchema.nullable().optional(),
  // Bakım
  maintenance_category: MaintenanceCategorySchema.nullable().optional(),
  maintenance_detail: z.record(z.string(), z.unknown()).nullable().optional(),
  maintenance_tier: z.string().nullable().optional(),
});
export type ServiceRequestDraftCreate = z.infer<
  typeof ServiceRequestDraftCreateSchema
>;

// ─── Response models ────────────────────────────────────────────────────────

// Mobil domain ServiceCaseStatusSchema ile paralel (10 değer). Backend
// "draft" + "paused" eklemiş ama mobil akışta henüz gösterilmez; backend
// yeni vaka create'de "matching" döner.
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

export const CaseCreateResponseSchema = z.object({
  id: z.string().uuid(),
  status: ServiceCaseStatusSchema,
  kind: ServiceRequestKindSchema,
  workflow_blueprint: z.string(),
  created_at: z.string(),
  title: z.string(),
});
export type CaseCreateResponse = z.infer<typeof CaseCreateResponseSchema>;

export const CaseSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  kind: ServiceRequestKindSchema,
  status: ServiceCaseStatusSchema,
  urgency: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  location_label: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseSummaryResponse = z.infer<typeof CaseSummaryResponseSchema>;
