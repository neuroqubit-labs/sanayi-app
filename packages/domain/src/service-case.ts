import { z } from "zod";

import { MediaAssetSchema } from "./media";

export const ServiceRequestKindSchema = z.enum([
  "accident",
  "towing",
  "breakdown",
  "maintenance",
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

export const CaseToneSchema = z.enum([
  "accent",
  "neutral",
  "success",
  "warning",
  "critical",
  "info",
]);
export type CaseTone = z.infer<typeof CaseToneSchema>;

export const CaseActorSchema = z.enum(["customer", "technician", "system"]);
export type CaseActor = z.infer<typeof CaseActorSchema>;

export const CaseWaitActorSchema = z.enum([
  "customer",
  "technician",
  "system",
  "none",
]);
export type CaseWaitActor = z.infer<typeof CaseWaitActorSchema>;

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

export const CaseAttachmentSchema = z.object({
  id: z.string(),
  kind: CaseAttachmentKindSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  statusLabel: z.string().optional(),
  asset: MediaAssetSchema.nullable().default(null),
  /**
   * Subtype-aware semantik etiket (matching-audit 2026-04-23 P0-5):
   * scene_overview, damage_detail, counterparty_plate, mileage_photo,
   * tire_photo, glass_current_view, vb. Subtype tablolarına attachment
   * snapshot ile gider; matching motoru ipucu olarak kullanabilir.
   * optional — mevcut fixture/mock'ları kırmamak için.
   */
  category: z.string().max(64).nullable().optional(),
});
export type CaseAttachment = z.infer<typeof CaseAttachmentSchema>;

export const CaseOfferStatusSchema = z.enum([
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "expired",
]);
export type CaseOfferStatus = z.infer<typeof CaseOfferStatusSchema>;

export const CaseOfferSchema = z.object({
  id: z.string(),
  technician_id: z.string(),
  headline: z.string(),
  description: z.string(),
  amount: z.number().nonnegative(),
  currency: z.string().default("TRY"),
  price_label: z.string(),
  eta_minutes: z.number().int().nonnegative(),
  eta_label: z.string(),
  available_at_label: z.string(),
  delivery_mode: z.string(),
  warranty_label: z.string(),
  status: CaseOfferStatusSchema,
  badges: z.array(z.string()).default([]),
});
export type CaseOffer = z.infer<typeof CaseOfferSchema>;

/**
 * FE event type kataloğu — BE `CaseEventType` (46 değer) içinden pilot
 * kullanıcısını etkileyen alt kümedir (F-P0-1 genişletme, 2026-04-23).
 * Timeline render + engine narrow check'ler bu enum üzerinden akar.
 * Enum genişlemesi geriye uyumlu: yeni değerler varsayılan olarak
 * status-kind timeline'ında görünür (event.title BE'den Türkçe geliyor).
 */
export const CaseEventTypeSchema = z.enum([
  // Case lifecycle
  "submitted",
  "status_update",
  "completed",
  "cancelled",
  "archived",

  // Offers
  "offer_received",
  "offer_accepted",
  "offer_rejected",
  "offer_withdrawn",

  // Appointment
  "appointment_requested",
  "appointment_approved",
  "appointment_declined",
  "appointment_cancelled",
  "appointment_expired",
  "appointment_counter",

  // Technician match
  "technician_selected",
  "technician_unassigned",

  // Approvals + delivery
  "parts_requested",
  "parts_approved",
  "parts_rejected",
  "invoice_shared",
  "invoice_approved",
  "invoice_issued",

  // Thread + docs + evidence
  "message",
  "document_added",
  "evidence_added",

  // Tow lifecycle
  "tow_stage_requested",
  "tow_stage_committed",
  "tow_evidence_added",
  "tow_fare_captured",

  // Billing
  "payment_initiated",
  "payment_authorized",
  "payment_captured",
  "payment_refunded",
  "billing_state_changed",

  // Insurance
  "insurance_claim_submitted",
  "insurance_claim_accepted",
  "insurance_claim_paid",
  "insurance_claim_rejected",
]);
export type CaseEventType = z.infer<typeof CaseEventTypeSchema>;

export const CaseEventSchema = z.object({
  id: z.string(),
  type: CaseEventTypeSchema,
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
  created_at_label: z.string(),
  tone: CaseToneSchema,
});
export type CaseEvent = z.infer<typeof CaseEventSchema>;

export const CaseMessageAuthorRoleSchema = z.enum([
  "customer",
  "technician",
  "system",
]);
export type CaseMessageAuthorRole = z.infer<typeof CaseMessageAuthorRoleSchema>;

export const CaseMessageSchema = z.object({
  id: z.string(),
  author_name: z.string(),
  author_role: CaseMessageAuthorRoleSchema,
  body: z.string(),
  created_at: z.string(),
  created_at_label: z.string(),
  attachments: z.array(CaseAttachmentSchema).default([]),
});
export type CaseMessage = z.infer<typeof CaseMessageSchema>;

export const CaseThreadSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  preview: z.string(),
  unread_count: z.number().int().nonnegative(),
  messages: z.array(CaseMessageSchema),
});
export type CaseThread = z.infer<typeof CaseThreadSchema>;

export const AccidentReportMethodSchema = z.enum([
  "e_devlet",
  "paper",
  "police",
]);
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

/**
 * Kaza hasar derecesi — BE DamageSeverity canonical.
 * Subtype refactor Faz 1c (2026-04-23): matching motoru skorunda
 * kullanılır; accident composer'da kullanıcı seçer.
 */
export const DamageSeveritySchema = z.enum([
  "minor",
  "moderate",
  "major",
  "total_loss",
]);
export type DamageSeverity = z.infer<typeof DamageSeveritySchema>;

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

export const ServiceRequestDraftSchema = z.object({
  kind: ServiceRequestKindSchema,
  vehicle_id: z.string(),
  urgency: ServiceRequestUrgencySchema,
  summary: z.string(),
  location_label: z.string(),
  dropoff_label: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(CaseAttachmentSchema).default([]),
  symptoms: z.array(z.string()).default([]),
  maintenance_items: z.array(z.string()).default([]),
  preferred_window: z.string().optional(),
  vehicle_drivable: z.boolean().nullable().default(null),
  towing_required: z.boolean().default(false),
  pickup_preference: ServicePickupPreferenceSchema.nullable().default(null),
  mileage_km: z.number().int().nullable().default(null),
  preferred_technician_id: z.string().nullable().default(null),
  counterparty_note: z.string().optional(),
  counterparty_vehicle_count: z.number().int().nullable().default(null),
  damage_area: z.string().optional(),
  /**
   * Matching-audit P0-5 + subtype refactor Faz 1c (2026-04-23):
   * damage_severity artık subtype payload'a gidiyor (accident_case
   * tablosuna yazılır). Accident composer'da kullanıcı seçer.
   * optional — mevcut mock/fixture'ları kırmamak için.
   */
  damage_severity: DamageSeveritySchema.nullable().optional(),
  valet_requested: z.boolean().default(false),
  report_method: AccidentReportMethodSchema.nullable().default(null),
  kasko_selected: z.boolean().default(false),
  kasko_brand: z.string().optional(),
  sigorta_selected: z.boolean().default(false),
  sigorta_brand: z.string().optional(),
  ambulance_contacted: z.boolean().default(false),
  emergency_acknowledged: z.boolean().default(false),
  breakdown_category: BreakdownCategorySchema.nullable().default(null),
  on_site_repair: z.boolean().default(false),
  price_preference: PricePreferenceSchema.nullable().default(null),
  maintenance_category: MaintenanceCategorySchema.nullable().default(null),
  /**
   * Serbest-şema JSONB (bakım paketi detayları: yağ viskozitesi, lastik
   * ebadı, film tonu vb.). BE maintenance_case tablosuna yazılır.
   * optional — mevcut mock/fixture'ları kırmamak için.
   */
  maintenance_detail: z.record(z.unknown()).nullable().optional(),
  maintenance_tier: z.string().optional(),
});
export type ServiceRequestDraft = z.infer<typeof ServiceRequestDraftSchema>;

export const ServiceCaseStatusSchema = z.enum([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
  "completed",
  "archived",
  "cancelled",
]);
export type ServiceCaseStatus = z.infer<typeof ServiceCaseStatusSchema>;

export const CaseActionTypeSchema = z.enum([
  "refresh_matching",
  "change_service_preference",
  "open_offers",
  "message_service",
  "request_appointment",
  "cancel_appointment",
  "cancel_case",
  "confirm_appointment",
  "approve_parts",
  "approve_invoice",
  "confirm_completion",
  "open_documents",
  "start_similar_request",
]);
export type CaseActionType = z.infer<typeof CaseActionTypeSchema>;

export const AppointmentSlotKindSchema = z.enum([
  "today",
  "tomorrow",
  "custom",
  "flexible",
]);
export type AppointmentSlotKind = z.infer<typeof AppointmentSlotKindSchema>;

export const AppointmentSlotSchema = z.object({
  kind: AppointmentSlotKindSchema,
  dateLabel: z.string().optional(),
  timeWindow: z.string().optional(),
});
export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>;

export const AppointmentStatusSchema = z.enum([
  "pending",
  "approved",
  "declined",
  "expired",
  "cancelled",
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const CaseOriginSchema = z.enum(["customer", "technician"]);
export type CaseOrigin = z.infer<typeof CaseOriginSchema>;

export const InsuranceClaimStatusSchema = z.enum([
  "drafted",
  "submitted",
  "accepted",
  "paid",
  "rejected",
]);
export type InsuranceClaimStatus = z.infer<typeof InsuranceClaimStatusSchema>;

export const InsuranceClaimSchema = z.object({
  policy_number: z.string(),
  insurer: z.string(),
  coverage_kind: z.enum(["kasko", "trafik"]),
  claim_amount_estimate: z.number().nullable().default(null),
  status: InsuranceClaimStatusSchema.default("drafted"),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
});
export type InsuranceClaim = z.infer<typeof InsuranceClaimSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  technician_id: z.string(),
  offer_id: z.string().nullable(),
  slot: AppointmentSlotSchema,
  note: z.string().default(""),
  status: AppointmentStatusSchema,
  requested_at: z.string(),
  expires_at: z.string(),
  responded_at: z.string().nullable().default(null),
  decline_reason: z.string().nullable().default(null),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const CaseApprovalKindSchema = z.enum([
  "parts_request",
  "invoice",
  "completion",
]);
export type CaseApprovalKind = z.infer<typeof CaseApprovalKindSchema>;

export const CaseApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type CaseApprovalStatus = z.infer<typeof CaseApprovalStatusSchema>;

export const CaseApprovalLineItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  note: z.string().optional(),
});
export type CaseApprovalLineItem = z.infer<typeof CaseApprovalLineItemSchema>;

export const CaseApprovalSchema = z.object({
  id: z.string(),
  kind: CaseApprovalKindSchema,
  status: CaseApprovalStatusSchema,
  title: z.string(),
  description: z.string(),
  requested_by: z.string(),
  requested_at: z.string(),
  requested_at_label: z.string(),
  amount_label: z.string().nullable().default(null),
  action_label: z.string().nullable().default(null),
  service_comment: z.string().optional(),
  line_items: z.array(CaseApprovalLineItemSchema).default([]),
  evidence_document_ids: z.array(z.string()).default([]),
});
export type CaseApproval = z.infer<typeof CaseApprovalSchema>;

export const CaseDocumentSchema = z.object({
  id: z.string(),
  kind: CaseAttachmentKindSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  source_label: z.string(),
  status_label: z.string(),
  created_at: z.string(),
  created_at_label: z.string(),
  asset: MediaAssetSchema.nullable().default(null),
});
export type CaseDocument = z.infer<typeof CaseDocumentSchema>;

export const CaseServiceSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  reason: z.string(),
  service_mode: z.string(),
  guarantee: z.string(),
  rating_label: z.string(),
  response_label: z.string(),
  distance_label: z.string(),
  badges: z.array(z.string()).default([]),
});
export type CaseServiceSnapshot = z.infer<typeof CaseServiceSnapshotSchema>;

export const CaseWorkflowBlueprintSchema = z.enum([
  "damage_insured",
  "damage_uninsured",
  "maintenance_standard",
  "maintenance_major",
]);
export type CaseWorkflowBlueprint = z.infer<
  typeof CaseWorkflowBlueprintSchema
>;

export const CaseMilestoneStatusSchema = z.enum([
  "completed",
  "active",
  "upcoming",
  "blocked",
]);
export type CaseMilestoneStatus = z.infer<typeof CaseMilestoneStatusSchema>;

export const CaseMilestoneSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  actor: CaseActorSchema,
  sequence: z.number().int(),
  status: CaseMilestoneStatusSchema,
  badge_label: z.string().optional(),
  blocker_reason: z.string().optional(),
  related_task_ids: z.array(z.string()).default([]),
});
export type CaseMilestone = z.infer<typeof CaseMilestoneSchema>;

export const CaseTaskKindSchema = z.enum([
  "refresh_matching",
  "review_offers",
  "confirm_appointment",
  "review_progress",
  "approve_parts",
  "approve_invoice",
  "confirm_completion",
  "message_service",
  "upload_intake_proof",
  "upload_progress_proof",
  "share_status_update",
  "request_parts_approval",
  "share_invoice",
  "upload_delivery_proof",
  "mark_ready_for_delivery",
  "start_similar_request",
  "open_documents",
]);
export type CaseTaskKind = z.infer<typeof CaseTaskKindSchema>;

export const CaseTaskStatusSchema = z.enum([
  "pending",
  "active",
  "completed",
  "blocked",
]);
export type CaseTaskStatus = z.infer<typeof CaseTaskStatusSchema>;

export const CaseTaskUrgencySchema = z.enum(["background", "soon", "now"]);
export type CaseTaskUrgency = z.infer<typeof CaseTaskUrgencySchema>;

export const CaseEvidenceRequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: CaseAttachmentKindSchema,
  required: z.boolean().default(true),
  hint: z.string().optional(),
});
export type CaseEvidenceRequirement = z.infer<
  typeof CaseEvidenceRequirementSchema
>;

export const CaseTaskSchema = z.object({
  id: z.string(),
  kind: CaseTaskKindSchema,
  title: z.string(),
  description: z.string(),
  actor: CaseActorSchema,
  milestone_id: z.string(),
  status: CaseTaskStatusSchema,
  urgency: CaseTaskUrgencySchema,
  cta_label: z.string(),
  helper_label: z.string().optional(),
  blocker_reason: z.string().optional(),
  related_offer_ids: z.array(z.string()).default([]),
  related_approval_id: z.string().nullable().default(null),
  related_document_ids: z.array(z.string()).default([]),
  evidence_requirements: z.array(CaseEvidenceRequirementSchema).default([]),
});
export type CaseTask = z.infer<typeof CaseTaskSchema>;

export const CaseEvidenceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  kind: CaseAttachmentKindSchema,
  actor: CaseActorSchema,
  source_label: z.string(),
  status_label: z.string(),
  created_at: z.string(),
  created_at_label: z.string(),
  task_id: z.string().nullable().default(null),
  milestone_id: z.string().nullable().default(null),
  is_new: z.boolean().default(false),
  asset: MediaAssetSchema.nullable().default(null),
});
export type CaseEvidenceItem = z.infer<typeof CaseEvidenceItemSchema>;

export const CaseWaitStateSchema = z.object({
  actor: CaseWaitActorSchema,
  label: z.string(),
  description: z.string(),
});
export type CaseWaitState = z.infer<typeof CaseWaitStateSchema>;

export const CaseNotificationIntentTypeSchema = z.enum([
  "customer_approval_needed",
  "quote_ready",
  "appointment_confirmation",
  "evidence_missing",
  "status_update_required",
  "delivery_ready",
  "payment_review",
]);
export type CaseNotificationIntentType = z.infer<
  typeof CaseNotificationIntentTypeSchema
>;

export const CaseNotificationIntentSchema = z.object({
  id: z.string(),
  type: CaseNotificationIntentTypeSchema,
  actor: CaseActorSchema,
  title: z.string(),
  body: z.string(),
  task_id: z.string().nullable().default(null),
  route_hint: z.string().optional(),
  is_new: z.boolean().default(false),
});
export type CaseNotificationIntent = z.infer<
  typeof CaseNotificationIntentSchema
>;

export const CaseDeltaKindSchema = z.enum([
  "evidence",
  "status",
  "approval",
  "message",
]);
export type CaseDeltaKind = z.infer<typeof CaseDeltaKindSchema>;

export const CaseDeltaSchema = z.object({
  id: z.string(),
  kind: CaseDeltaKindSchema,
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
  created_at_label: z.string(),
  tone: CaseToneSchema,
});
export type CaseDelta = z.infer<typeof CaseDeltaSchema>;

export const CaseLastSeenByActorSchema = z.object({
  customer: z.string().nullable().default(null),
  technician: z.string().nullable().default(null),
});
export type CaseLastSeenByActor = z.infer<typeof CaseLastSeenByActorSchema>;

export const ServiceCaseSchema = z.object({
  id: z.string(),
  vehicle_id: z.string(),
  kind: ServiceRequestKindSchema,
  status: ServiceCaseStatusSchema,
  title: z.string(),
  subtitle: z.string(),
  summary: z.string(),
  created_at: z.string(),
  created_at_label: z.string(),
  updated_at: z.string(),
  updated_at_label: z.string(),
  request: ServiceRequestDraftSchema,
  assigned_technician_id: z.string().nullable(),
  preferred_technician_id: z.string().nullable(),
  next_action_title: z.string(),
  next_action_description: z.string(),
  next_action_primary_label: z.string(),
  next_action_secondary_label: z.string().nullable(),
  total_label: z.string().nullable(),
  estimate_label: z.string().nullable(),
  allowed_actions: z.array(CaseActionTypeSchema).default([]),
  pending_approvals: z.array(CaseApprovalSchema).default([]),
  assigned_service: CaseServiceSnapshotSchema.nullable().default(null),
  documents: z.array(CaseDocumentSchema).default([]),
  offers: z.array(CaseOfferSchema),
  attachments: z.array(CaseAttachmentSchema),
  events: z.array(CaseEventSchema),
  thread: CaseThreadSchema,
  workflow_blueprint: CaseWorkflowBlueprintSchema,
  milestones: z.array(CaseMilestoneSchema).default([]),
  tasks: z.array(CaseTaskSchema).default([]),
  evidence_feed: z.array(CaseEvidenceItemSchema).default([]),
  wait_state: CaseWaitStateSchema.default({
    actor: "system",
    label: "Sistem calisiyor",
    description: "Surec platform tarafinda toparlaniyor.",
  }),
  last_seen_by_actor: CaseLastSeenByActorSchema.default({
    customer: null,
    technician: null,
  }),
  notification_intents: z.array(CaseNotificationIntentSchema).default([]),
  appointment: AppointmentSchema.nullable().default(null),
  origin: CaseOriginSchema.default("customer"),
  insurance_claim: InsuranceClaimSchema.nullable().default(null),
  /**
   * F-P1-1 (2026-04-23 lifecycle audit L3-P1-1): kind-aware engine
   * için `tow_stage` ServiceCase shape'inde optional. Canonical
   * adapter `subtype.tow_stage`'i buraya projekte eder; engine
   * `syncTowTrackingCase` stage-first milestone + next_action
   * derivation'ı için okur. Tow kind dışında undefined kalır.
   *
   * String tipinde bırakıldı (TowDispatchStage import edip domain'ler
   * arası circular olmasın); engine'de cast edilir. Optional — mevcut
   * mock/fixture'ları kırmamak için (geriye uyumlu).
   */
  tow_stage: z.string().nullable().optional(),
});
export type ServiceCase = z.infer<typeof ServiceCaseSchema>;
