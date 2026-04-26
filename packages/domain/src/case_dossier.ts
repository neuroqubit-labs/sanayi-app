import { z } from "zod";

import {
  AppointmentSlotKindSchema,
  CaseActorSchema,
  CaseApprovalKindSchema,
  CaseApprovalStatusSchema,
  CaseAttachmentKindSchema,
  CaseOriginSchema,
  CaseTaskKindSchema,
  CaseTaskStatusSchema,
  CaseTaskUrgencySchema,
  CaseToneSchema,
  ServiceCaseStatusSchema,
  ServiceRequestKindSchema,
  ServiceRequestUrgencySchema,
} from "./service-case";
import {
  TowDispatchStageSchema,
  TowIncidentReasonSchema,
  TowServiceModeSchema,
  TowVehicleEquipmentSchema,
} from "./tow";
import { ApprovalPaymentStateSchema } from "./approval";

const UuidSchema = z.string().uuid();
const DateTimeSchema = z.string();
const DecimalWireSchema = z.union([z.string(), z.number()]);
const JsonObjectSchema = z.record(z.unknown());

export const CaseDossierViewerRoleSchema = z.enum([
  "customer",
  "pool_technician",
  "assigned_technician",
]);
export type CaseDossierViewerRole = z.infer<
  typeof CaseDossierViewerRoleSchema
>;

export const DossierCaseWaitActorSchema = z.enum([
  "customer",
  "technician",
  "system",
  "none",
]);

export const DossierCaseWaitStateSchema = z.object({
  actor: DossierCaseWaitActorSchema,
  label: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
});

export const CaseShellSectionSchema = z.object({
  id: UuidSchema,
  kind: ServiceRequestKindSchema,
  status: ServiceCaseStatusSchema,
  urgency: ServiceRequestUrgencySchema,
  origin: CaseOriginSchema,
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  location_label: z.string().nullable().default(null),
  wait_state: DossierCaseWaitStateSchema,
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
  closed_at: DateTimeSchema.nullable().default(null),
});
export type CaseShellSection = z.infer<typeof CaseShellSectionSchema>;

export const VehicleSnapshotSectionSchema = z.object({
  plate: z.string(),
  make: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  year: z.number().int().nullable().default(null),
  fuel_type: z.string().nullable().default(null),
  vin: z.string().nullable().default(null),
  current_km: z.number().int().nullable().default(null),
});
export type VehicleSnapshotSection = z.infer<
  typeof VehicleSnapshotSectionSchema
>;

export const AccidentDetailSchema = z.object({
  kind: z.literal("accident"),
  damage_area: z.string().nullable().default(null),
  damage_severity: z.string().nullable().default(null),
  counterparty_count: z.number().int().default(0),
  counterparty_note: z.string().nullable().default(null),
  kasko_selected: z.boolean().default(false),
  sigorta_selected: z.boolean().default(false),
  kasko_brand: z.string().nullable().default(null),
  sigorta_brand: z.string().nullable().default(null),
  ambulance_contacted: z.boolean().default(false),
  report_method: z.string().nullable().default(null),
  emergency_acknowledged: z.boolean().default(false),
});

export const BreakdownDetailSchema = z.object({
  kind: z.literal("breakdown"),
  breakdown_category: z.string(),
  symptoms: z.string().nullable().default(null),
  vehicle_drivable: z.boolean().nullable().default(null),
  on_site_repair_requested: z.boolean().default(false),
  valet_requested: z.boolean().default(false),
  pickup_preference: z.string().nullable().default(null),
  price_preference: z.string().nullable().default(null),
});

export const MaintenanceDetailSchema = z.object({
  kind: z.literal("maintenance"),
  maintenance_category: z.string(),
  maintenance_detail: JsonObjectSchema.nullable().default(null),
  maintenance_tier: z.string().nullable().default(null),
  service_style_preference: z.string().nullable().default(null),
  mileage_km: z.number().int().nullable().default(null),
  valet_requested: z.boolean().default(false),
  pickup_preference: z.string().nullable().default(null),
  price_preference: z.string().nullable().default(null),
});

export const TowingDetailSchema = z.object({
  kind: z.literal("towing"),
  tow_mode: TowServiceModeSchema,
  tow_stage: TowDispatchStageSchema,
  required_equipment: z.array(TowVehicleEquipmentSchema).nullable().default(null),
  incident_reason: TowIncidentReasonSchema.nullable().default(null),
  scheduled_at: DateTimeSchema.nullable().default(null),
  pickup_label: z.string().nullable().default(null),
  dropoff_label: z.string().nullable().default(null),
  parent_case_id: UuidSchema.nullable().default(null),
});

export const KindDetailSectionSchema = z.discriminatedUnion("kind", [
  AccidentDetailSchema,
  BreakdownDetailSchema,
  MaintenanceDetailSchema,
  TowingDetailSchema,
]);
export type KindDetailSection = z.infer<typeof KindDetailSectionSchema>;

export const CaseAttachmentSummarySchema = z.object({
  id: UuidSchema,
  kind: CaseAttachmentKindSchema,
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  status_label: z.string().nullable().default(null),
  media_asset_id: UuidSchema.nullable().default(null),
  created_at: DateTimeSchema.nullable().default(null),
});
export type CaseAttachmentSummary = z.infer<
  typeof CaseAttachmentSummarySchema
>;

export const CaseEvidenceSummarySchema = z.object({
  id: UuidSchema,
  kind: CaseAttachmentKindSchema,
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  actor: z.string(),
  source_label: z.string(),
  status_label: z.string(),
  media_asset_id: UuidSchema.nullable().default(null),
  created_at: DateTimeSchema.nullable().default(null),
});
export type CaseEvidenceSummary = z.infer<typeof CaseEvidenceSummarySchema>;

export const CaseDocumentSummarySchema = z.object({
  id: UuidSchema,
  kind: CaseAttachmentKindSchema,
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  source_label: z.string(),
  status_label: z.string(),
  media_asset_id: UuidSchema.nullable().default(null),
  created_at: DateTimeSchema.nullable().default(null),
});
export type CaseDocumentSummary = z.infer<typeof CaseDocumentSummarySchema>;

export const CaseTechnicianMatchVisibilitySchema = z.enum([
  "candidate",
  "shown_to_customer",
  "hidden",
  "invalidated",
]);

export const MatchNotifyStateSchema = z.enum([
  "available",
  "already_notified",
  "has_offer",
  "limit_reached",
  "not_compatible",
]);
export type MatchNotifyState = z.infer<typeof MatchNotifyStateSchema>;

export const MatchSummarySchema = z.object({
  id: UuidSchema,
  technician_profile_id: UuidSchema.nullable().default(null),
  technician_user_id: UuidSchema.nullable().default(null),
  display_name: z.string().nullable().default(null),
  tagline: z.string().nullable().default(null),
  provider_type: z.string().nullable().default(null),
  area_label: z.string().nullable().default(null),
  verified_level: z.string().nullable().default(null),
  avatar_asset_id: UuidSchema.nullable().default(null),
  score: DecimalWireSchema,
  reason_label: z.string(),
  match_badge: z.string().default("Bu vakaya uygun"),
  visibility_state: CaseTechnicianMatchVisibilitySchema,
  can_notify: z.boolean().default(false),
  notify_state: MatchNotifyStateSchema.default("not_compatible"),
  notify_disabled_reason: z.string().nullable().default(null),
});
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

export const CaseTechnicianNotificationStatusSchema = z.enum([
  "sent",
  "seen",
  "dismissed",
  "offer_created",
  "expired",
]);

export const NotificationSummarySchema = z.object({
  id: UuidSchema,
  technician_user_id: UuidSchema.nullable().default(null),
  status: CaseTechnicianNotificationStatusSchema,
  created_at: DateTimeSchema,
  seen_at: DateTimeSchema.nullable().default(null),
  responded_at: DateTimeSchema.nullable().default(null),
});
export type NotificationSummary = z.infer<typeof NotificationSummarySchema>;

export const DossierOfferStatusSchema = z.enum([
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
]);

export const OfferSummarySchema = z.object({
  id: UuidSchema,
  technician_user_id: UuidSchema.nullable().default(null),
  technician_display_label: z.string().nullable().default(null),
  amount: DecimalWireSchema.nullable().default(null),
  currency: z.string(),
  status: DossierOfferStatusSchema,
  slot_proposal: JsonObjectSchema.nullable().default(null),
  created_at: DateTimeSchema,
});
export type OfferSummary = z.infer<typeof OfferSummarySchema>;

export const DossierAppointmentStatusSchema = z.enum([
  "pending",
  "approved",
  "declined",
  "expired",
  "cancelled",
  "counter_pending",
]);

export const AppointmentSourceSchema = z.enum([
  "offer_accept",
  "direct_request",
  "counter",
]);

export const AppointmentSummarySchema = z.object({
  id: UuidSchema,
  status: DossierAppointmentStatusSchema,
  slot: JsonObjectSchema,
  slot_kind: AppointmentSlotKindSchema,
  source: AppointmentSourceSchema,
  counter_proposal: JsonObjectSchema.nullable().default(null),
  expires_at: DateTimeSchema.nullable().default(null),
});
export type AppointmentSummary = z.infer<typeof AppointmentSummarySchema>;

export const AssignmentSummarySchema = z.object({
  technician_user_id: UuidSchema,
  technician_display_name: z.string(),
  accepted_offer_id: UuidSchema.nullable().default(null),
  assigned_at: DateTimeSchema,
});
export type AssignmentSummary = z.infer<typeof AssignmentSummarySchema>;

export const ApprovalSummarySchema = z.object({
  id: UuidSchema,
  kind: CaseApprovalKindSchema,
  title: z.string(),
  description: z.string().nullable().default(null),
  amount: DecimalWireSchema.nullable().default(null),
  currency: z.string(),
  status: CaseApprovalStatusSchema,
  payment_state: ApprovalPaymentStateSchema,
  created_at: DateTimeSchema,
});
export type ApprovalSummary = z.infer<typeof ApprovalSummarySchema>;

export const PaymentSnapshotSchema = z.object({
  billing_state: z.string().nullable().default(null),
  estimate_amount: DecimalWireSchema.nullable().default(null),
  total_amount: DecimalWireSchema.nullable().default(null),
  preauth_held: DecimalWireSchema.nullable().default(null),
  captured: DecimalWireSchema.nullable().default(null),
  refunded: DecimalWireSchema.nullable().default(null),
  last_event_at: DateTimeSchema.nullable().default(null),
});
export type PaymentSnapshot = z.infer<typeof PaymentSnapshotSchema>;

export const TowSnapshotSchema = z.object({
  tow_mode: TowServiceModeSchema,
  tow_stage: TowDispatchStageSchema,
  scheduled_at: DateTimeSchema.nullable().default(null),
  pickup_label: z.string().nullable().default(null),
  dropoff_label: z.string().nullable().default(null),
  quote: JsonObjectSchema.nullable().default(null),
  preauth_amount: DecimalWireSchema.nullable().default(null),
  captured_amount: DecimalWireSchema.nullable().default(null),
});
export type TowSnapshot = z.infer<typeof TowSnapshotSchema>;

export const CaseMilestoneSummarySchema = z.object({
  id: UuidSchema,
  milestone_key: z.string(),
  title: z.string(),
  description: z.string().nullable().default(null),
  actor: CaseActorSchema,
  status: z.enum(["completed", "active", "upcoming", "blocked"]),
  order: z.number().int(),
});
export type CaseMilestoneSummary = z.infer<
  typeof CaseMilestoneSummarySchema
>;

export const CaseTaskSummarySchema = z.object({
  id: UuidSchema,
  task_key: z.string(),
  kind: CaseTaskKindSchema,
  title: z.string(),
  description: z.string().nullable().default(null),
  actor: CaseActorSchema,
  status: CaseTaskStatusSchema,
  urgency: CaseTaskUrgencySchema,
  cta_label: z.string(),
  helper_label: z.string().nullable().default(null),
  milestone_key: z.string(),
});
export type CaseTaskSummary = z.infer<typeof CaseTaskSummarySchema>;

export const DossierCaseEventTypeSchema = z.enum([
  "submitted",
  "offer_received",
  "offer_accepted",
  "offer_rejected",
  "offer_withdrawn",
  "appointment_requested",
  "appointment_approved",
  "appointment_declined",
  "appointment_cancelled",
  "appointment_expired",
  "appointment_counter",
  "technician_selected",
  "technician_unassigned",
  "status_update",
  "parts_requested",
  "parts_approved",
  "parts_rejected",
  "invoice_shared",
  "invoice_approved",
  "invoice_issued",
  "evidence_added",
  "document_added",
  "message",
  "wait_state_changed",
  "completed",
  "cancelled",
  "archived",
  "soft_deleted",
  "insurance_claim_submitted",
  "insurance_claim_accepted",
  "insurance_claim_paid",
  "insurance_claim_rejected",
  "tow_stage_requested",
  "tow_stage_committed",
  "tow_evidence_added",
  "tow_location_recorded",
  "tow_fare_captured",
  "tow_dispatch_candidate_selected",
  "payment_initiated",
  "payment_authorized",
  "payment_captured",
  "payment_refunded",
  "commission_calculated",
  "payout_scheduled",
  "payout_completed",
  "billing_state_changed",
  "offer_auto_rejected",
  "appointment_auto_cancelled",
  "approval_auto_rejected",
  "offer_expired",
  "auto_archived",
]);

export const TimelineEventSummarySchema = z.object({
  id: UuidSchema,
  event_type: DossierCaseEventTypeSchema,
  title: z.string(),
  tone: CaseToneSchema,
  actor_user_id: UuidSchema.nullable().default(null),
  context_summary: z.string().nullable().default(null),
  occurred_at: DateTimeSchema,
});
export type TimelineEventSummary = z.infer<typeof TimelineEventSummarySchema>;

export const ViewerContextSchema = z.object({
  role: CaseDossierViewerRoleSchema,
  is_matched_to_me: z.boolean().default(false),
  match_reason_label: z.string().nullable().default(null),
  match_badge: z.string().nullable().default(null),
  is_notified_to_me: z.boolean().default(false),
  has_offer_from_me: z.boolean().default(false),
  can_send_offer: z.boolean().default(false),
  can_notify_to_me: z.boolean().default(false),
  other_match_count: z.number().int().default(0),
  competitor_offer_average: DecimalWireSchema.nullable().default(null),
  competitor_offer_count: z.number().int().default(0),
});
export type ViewerContext = z.infer<typeof ViewerContextSchema>;

export const CaseDossierResponseSchema = z.object({
  shell: CaseShellSectionSchema,
  vehicle: VehicleSnapshotSectionSchema,
  kind_detail: KindDetailSectionSchema,
  attachments: z.array(CaseAttachmentSummarySchema).default([]),
  evidence: z.array(CaseEvidenceSummarySchema).default([]),
  documents: z.array(CaseDocumentSummarySchema).default([]),
  matches: z.array(MatchSummarySchema).default([]),
  notifications: z.array(NotificationSummarySchema).default([]),
  offers: z.array(OfferSummarySchema).default([]),
  appointment: AppointmentSummarySchema.nullable().default(null),
  assignment: AssignmentSummarySchema.nullable().default(null),
  approvals: z.array(ApprovalSummarySchema).default([]),
  payment_snapshot: PaymentSnapshotSchema,
  tow_snapshot: TowSnapshotSchema.nullable().default(null),
  milestones: z.array(CaseMilestoneSummarySchema).default([]),
  tasks: z.array(CaseTaskSummarySchema).default([]),
  timeline_summary: z.array(TimelineEventSummarySchema).default([]),
  viewer: ViewerContextSchema,
});
export type CaseDossierResponse = z.infer<typeof CaseDossierResponseSchema>;
