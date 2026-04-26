import type {
  Appointment,
  CaseApproval,
  CaseAttachment,
  CaseDocument,
  CaseEvent,
  CaseEventType as FeCaseEventType,
  CaseMessage,
  CaseThread,
  ServiceCase,
  ServiceCaseStatus,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import { CaseWorkflowBlueprintSchema } from "@naro/domain";
import {
  buildTechnicianTrackingView,
  syncTrackingCase,
  type DeliveryReportPayload,
} from "@naro/mobile-core";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import { apiClient } from "@/runtime";

import type { ApprovalLineItem } from "../approvals/schemas";

import { PoolCaseDetailSchema, type PoolCaseDetail } from "./schemas";

type CanonicalJobBundle = {
  detail: CaseDetailResponse;
  approvals: ApprovalWire[];
  documents: CaseDocumentItem[];
  events: CaseEventItem[];
  messages: ThreadMessageResponse[];
  appointments: AppointmentWire[];
};

type PartsApprovalInput = {
  lineItems: { label: string; qty: string; unit: string }[];
  note?: string;
  amount?: number;
};

type InvoiceApprovalInput = {
  title: string;
  amount: string;
  note?: string;
};

const ServiceRequestKindSchema = z.enum([
  "accident",
  "breakdown",
  "maintenance",
  "towing",
]);

const ServiceCaseStatusSchema = z.enum([
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

const ServiceRequestUrgencySchema = z.enum([
  "planned",
  "today",
  "urgent",
]);

const CaseWaitActorSchema = z.enum([
  "customer",
  "technician",
  "system",
  "none",
]);

const VehicleSnapshotResponseSchema = z.object({
  plate: z.string(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  fuel_type: z.string().nullable().optional(),
  vin: z.string().nullable().optional(),
  current_km: z.number().int().nullable().optional(),
});

const CaseNextActionSchema = z.object({
  actor: CaseWaitActorSchema.nullable().optional(),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  waiting_on_me: z.boolean().optional(),
});

const CaseDetailResponseSchema = z.object({
  id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  kind: ServiceRequestKindSchema,
  status: ServiceCaseStatusSchema,
  urgency: ServiceRequestUrgencySchema.or(z.string()),
  title: z.string(),
  summary: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  location_label: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  vehicle_snapshot: VehicleSnapshotResponseSchema.nullable().optional(),
  subtype: z.record(z.unknown()).nullable().optional(),
  parent_case_id: z.string().uuid().nullable().optional(),
  linked_tow_case_ids: z.array(z.string().uuid()).default([]),
  customer_notes: z.string().nullable().optional(),
  wait_state_actor: CaseWaitActorSchema.nullable().optional(),
  wait_state_label: z.string().nullable().optional(),
  wait_state_description: z.string().nullable().optional(),
  next_action: CaseNextActionSchema.nullable().optional(),
  estimate_amount: z.string().nullable().optional(),
  assigned_technician_id: z.string().uuid().nullable().optional(),
  workflow_blueprint: CaseWorkflowBlueprintSchema,
});
type CaseDetailResponse = z.infer<typeof CaseDetailResponseSchema>;

const ApprovalLineItemWireSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string(),
  value: z.string(),
  note: z.string().nullable().optional(),
  sequence: z.number().int().optional(),
});

const ApprovalWireSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: z.enum(["parts_request", "invoice", "completion"]),
  status: z.enum(["pending", "approved", "rejected"]),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  requested_at: z.string().optional(),
  created_at: z.string(),
  amount: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
  service_comment: z.string().nullable().optional(),
  resolver_note: z.string().nullable().optional(),
  line_items: z.array(ApprovalLineItemWireSchema).default([]),
});
type ApprovalWire = z.infer<typeof ApprovalWireSchema>;

const CaseDocumentItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    "damage_photo",
    "invoice",
    "kasko_form",
    "police_report",
    "parts_receipt",
    "other",
  ]),
  title: z.string(),
  signed_url: z.string(),
  uploader_role: z.enum(["customer", "technician", "admin"]).nullable().optional(),
  uploader_user_id: z.string().uuid().nullable().optional(),
  uploaded_at: z.string(),
  size_bytes: z.number().int().nonnegative(),
  mime_type: z.string(),
  antivirus_verdict: z.enum(["clean", "pending", "infected"]),
});
type CaseDocumentItem = z.infer<typeof CaseDocumentItemSchema>;

const CaseDocumentListResponseSchema = z.object({
  items: z.array(CaseDocumentItemSchema),
});

const CaseEventTypeSchema = z.enum([
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
  "invoice_issued",
]);
type BeCaseEventType = z.infer<typeof CaseEventTypeSchema>;

const CaseEventItemSchema = z.object({
  id: z.string().uuid(),
  type: CaseEventTypeSchema,
  title: z.string(),
  body: z.string().nullable().optional(),
  tone: z.enum(["accent", "neutral", "success", "warning", "critical", "info"]),
  actor_user_id: z.string().uuid().nullable().optional(),
  actor_role: z.enum(["customer", "technician", "admin", "system"]).nullable().optional(),
  context: z.record(z.unknown()),
  created_at: z.string(),
});
type CaseEventItem = z.infer<typeof CaseEventItemSchema>;

const CaseEventListResponseSchema = z.object({
  items: z.array(CaseEventItemSchema),
  next_cursor: z.string().nullable().optional(),
});

const ThreadMessageResponseSchema = z.object({
  id: z.string().uuid(),
  sender_role: z.enum(["customer", "technician"]),
  content: z.string(),
  created_at: z.string(),
});
type ThreadMessageResponse = z.infer<typeof ThreadMessageResponseSchema>;

const ThreadMessageListResponseSchema = z.object({
  items: z.array(ThreadMessageResponseSchema),
  next_cursor: z.string().nullable().optional(),
});

const AppointmentWireSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  offer_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "approved", "declined", "expired", "cancelled"]),
  slot: z.record(z.unknown()).default({}),
  slot_kind: z.enum(["today", "tomorrow", "custom", "flexible"]).optional(),
  note: z.string().default(""),
  decline_reason: z.string().nullable().optional(),
  requested_at: z.string(),
  responded_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
type AppointmentWire = z.infer<typeof AppointmentWireSchema>;

const AppointmentListResponseSchema = z.array(AppointmentWireSchema);

const TechnicianCaseSummarySchema = z.object({
  id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  kind: ServiceRequestKindSchema,
  urgency: ServiceRequestUrgencySchema,
  status: ServiceCaseStatusSchema,
  workflow_blueprint: CaseWorkflowBlueprintSchema,
  title: z.string(),
  summary: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  location_label: z.string().nullable().optional(),
  estimate_amount: z.string().nullable().optional(),
  assigned_technician_id: z.string().uuid().nullable().optional(),
  preferred_technician_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
type TechnicianCaseSummary = z.infer<typeof TechnicianCaseSummarySchema>;

const TechnicianCaseSummaryListSchema = z.array(TechnicianCaseSummarySchema);

const BE_TO_FE_EVENT_TYPE: Partial<Record<BeCaseEventType, FeCaseEventType>> = {
  submitted: "submitted",
  status_update: "status_update",
  completed: "completed",
  cancelled: "cancelled",
  archived: "archived",
  offer_received: "offer_received",
  offer_accepted: "offer_accepted",
  offer_rejected: "offer_rejected",
  offer_withdrawn: "offer_withdrawn",
  appointment_requested: "appointment_requested",
  appointment_approved: "appointment_approved",
  appointment_declined: "appointment_declined",
  appointment_cancelled: "appointment_cancelled",
  appointment_expired: "appointment_expired",
  appointment_counter: "appointment_counter",
  technician_selected: "technician_selected",
  technician_unassigned: "technician_unassigned",
  parts_requested: "parts_requested",
  parts_approved: "parts_approved",
  parts_rejected: "parts_rejected",
  invoice_shared: "invoice_shared",
  invoice_approved: "invoice_approved",
  invoice_issued: "invoice_issued",
  message: "message",
  document_added: "document_added",
  evidence_added: "evidence_added",
  tow_stage_requested: "tow_stage_requested",
  tow_stage_committed: "tow_stage_committed",
  tow_evidence_added: "tow_evidence_added",
  tow_fare_captured: "tow_fare_captured",
  payment_initiated: "payment_initiated",
  payment_authorized: "payment_authorized",
  payment_captured: "payment_captured",
  payment_refunded: "payment_refunded",
  billing_state_changed: "billing_state_changed",
  insurance_claim_submitted: "insurance_claim_submitted",
  insurance_claim_accepted: "insurance_claim_accepted",
  insurance_claim_paid: "insurance_claim_paid",
  insurance_claim_rejected: "insurance_claim_rejected",
};

const DOCUMENT_KIND_TO_ATTACHMENT_KIND: Record<
  CaseDocumentItem["kind"],
  CaseAttachment["kind"]
> = {
  damage_photo: "photo",
  invoice: "invoice",
  kasko_form: "document",
  police_report: "report",
  parts_receipt: "invoice",
  other: "document",
};

function formatRelativeTurkish(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} gün önce`;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toFiniteNumber(input: string | number | null | undefined): number {
  if (input == null) return 0;
  const parsed = Number.parseFloat(String(input).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimalString(input: string | number | null | undefined): string | null {
  const parsed = toFiniteNumber(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed.toFixed(2);
}

function priceLabel(amount: string | number | null | undefined, currency = "TRY") {
  const value = toFiniteNumber(amount);
  if (value <= 0) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency === "TRY" ? "₺" : currency}`;
}

function approvalTitle(kind: CaseApproval["kind"], fallback?: string | null) {
  if (fallback?.trim()) return fallback.trim();
  if (kind === "parts_request") return "Parça/kapsam onayı";
  if (kind === "invoice") return "Fatura onayı";
  return "Tamamlama onayı";
}

function approvalToDomain(approval: ApprovalWire): CaseApproval {
  return {
    id: approval.id,
    kind: approval.kind,
    status: approval.status,
    title: approvalTitle(approval.kind, approval.title),
    description: approval.description ?? "",
    requested_by: "Servis",
    requested_at: approval.requested_at ?? approval.created_at,
    requested_at_label: formatRelativeTurkish(
      approval.requested_at ?? approval.created_at,
    ),
    amount_label: priceLabel(approval.amount, approval.currency),
    action_label: null,
    service_comment:
      approval.service_comment ?? approval.resolver_note ?? undefined,
    line_items: approval.line_items.map((item, index) => ({
      id: item.id ?? `${approval.id}-line-${index}`,
      label: item.label,
      value: item.value,
      note: item.note ?? undefined,
    })),
    evidence_document_ids: [],
  };
}

function documentToDomain(doc: CaseDocumentItem, caseId: string): CaseDocument {
  const kind = DOCUMENT_KIND_TO_ATTACHMENT_KIND[doc.kind];
  return {
    id: doc.id,
    kind,
    title: doc.title,
    subtitle: doc.mime_type,
    source_label:
      doc.uploader_role === "customer"
        ? "Müşteri"
        : doc.uploader_role === "technician"
          ? "Servis"
          : "Sistem",
    status_label:
      doc.antivirus_verdict === "clean"
        ? "Temiz"
        : doc.antivirus_verdict === "pending"
          ? "Taranıyor"
          : "Güvensiz",
    created_at: doc.uploaded_at,
    created_at_label: formatRelativeTurkish(doc.uploaded_at),
    asset: {
      id: doc.id,
      purpose: "case_evidence_photo",
      owner_kind: "service_case",
      owner_id: caseId,
      visibility: "private",
      status: "ready",
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      checksum_sha256: null,
      dimensions: null,
      duration_sec: null,
      preview_url: doc.signed_url,
      download_url: doc.signed_url,
      created_at: doc.uploaded_at,
      uploaded_at: doc.uploaded_at,
      exif_stripped_at: null,
      antivirus_scanned_at:
        doc.antivirus_verdict === "pending" ? null : doc.uploaded_at,
    },
  };
}

function eventToDomain(event: CaseEventItem): CaseEvent | null {
  const type = BE_TO_FE_EVENT_TYPE[event.type];
  if (!type) return null;
  return {
    id: event.id,
    type,
    title: event.title || "Vaka güncellendi",
    body: event.body ?? "",
    created_at: event.created_at,
    created_at_label: formatRelativeTurkish(event.created_at),
    tone: event.tone,
  };
}

function threadMessageToDomain(message: ThreadMessageResponse): CaseMessage {
  return {
    id: message.id,
    author_name: message.sender_role === "technician" ? "Sen" : "Müşteri",
    author_role: message.sender_role,
    body: message.content,
    created_at: message.created_at,
    created_at_label: formatClock(message.created_at),
    attachments: [],
  };
}

function buildThread(
  caseId: string,
  messages: ThreadMessageResponse[],
): CaseThread {
  const sorted = [...messages].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const last = sorted[sorted.length - 1];
  return {
    id: `thread-${caseId}`,
    case_id: caseId,
    preview: last?.content ?? "",
    unread_count: 0,
    messages: sorted.map(threadMessageToDomain),
  };
}

function parseSymptoms(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((value): value is string => typeof value === "string");
  }
  if (typeof input !== "string") return [];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((value): value is string => typeof value === "string");
  }
  if (typeof input !== "string") return [];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildRequestFromDetail(detail: CaseDetailResponse): ServiceRequestDraft {
  const subtype = (detail.subtype ?? {}) as Record<string, unknown>;
  return {
    kind: detail.kind,
    vehicle_id: detail.vehicle_id,
    urgency: (detail.urgency as ServiceRequestDraft["urgency"]) ?? "planned",
    summary: detail.summary ?? detail.title,
    location_label: detail.location_label ?? "",
    location_lat_lng: null,
    dropoff_label:
      (subtype.dropoff_address as string | undefined) ??
      (subtype.dropoff_label as string | undefined),
    dropoff_lat_lng: null,
    notes: detail.customer_notes ?? undefined,
    attachments: [],
    symptoms: parseSymptoms(subtype.symptoms),
    maintenance_items: parseStringArray(subtype.maintenance_items),
    preferred_window:
      (subtype.scheduled_at as string | undefined) ?? undefined,
    vehicle_drivable:
      (subtype.vehicle_drivable as boolean | null | undefined) ?? null,
    towing_required: detail.kind === "towing",
    towing_decision_made: detail.kind === "towing",
    pickup_preference:
      (subtype.pickup_preference as ServiceRequestDraft["pickup_preference"]) ??
      null,
    mileage_km:
      (subtype.mileage_km as number | null | undefined) ??
      detail.vehicle_snapshot?.current_km ??
      null,
    preferred_technician_id: null,
    counterparty_note:
      (subtype.counterparty_note as string | undefined) ?? undefined,
    counterparty_vehicle_count:
      (subtype.counterparty_count as number | null | undefined) ?? null,
    damage_area: (subtype.damage_area as string | undefined) ?? undefined,
    damage_severity:
      (subtype.damage_severity as ServiceRequestDraft["damage_severity"]) ??
      undefined,
    valet_requested: (subtype.valet_requested as boolean | undefined) ?? false,
    report_method:
      (subtype.report_method as ServiceRequestDraft["report_method"]) ?? null,
    kasko_selected: (subtype.kasko_selected as boolean | undefined) ?? false,
    kasko_brand: (subtype.kasko_brand as string | undefined) ?? undefined,
    sigorta_selected:
      (subtype.sigorta_selected as boolean | undefined) ?? false,
    sigorta_brand: (subtype.sigorta_brand as string | undefined) ?? undefined,
    ambulance_contacted:
      (subtype.ambulance_contacted as boolean | undefined) ?? false,
    emergency_acknowledged:
      (subtype.emergency_acknowledged as boolean | undefined) ?? false,
    breakdown_category:
      (subtype.breakdown_category as ServiceRequestDraft["breakdown_category"]) ??
      null,
    on_site_repair:
      (subtype.on_site_repair_requested as boolean | undefined) ?? false,
    price_preference:
      (subtype.price_preference as ServiceRequestDraft["price_preference"]) ??
      null,
    maintenance_category:
      (subtype.maintenance_category as ServiceRequestDraft["maintenance_category"]) ??
      null,
    maintenance_detail:
      (subtype.maintenance_detail as Record<string, unknown> | null | undefined) ??
      null,
    maintenance_tier:
      (subtype.maintenance_tier as string | undefined) ?? undefined,
    tow_mode: (subtype.tow_mode as ServiceRequestDraft["tow_mode"]) ?? null,
    tow_required_equipment:
      (subtype.tow_required_equipment as ServiceRequestDraft["tow_required_equipment"]) ??
      [],
    tow_incident_reason:
      (subtype.incident_reason as ServiceRequestDraft["tow_incident_reason"]) ??
      null,
    tow_scheduled_at: (subtype.scheduled_at as string | null | undefined) ?? null,
    tow_parent_case_id:
      (subtype.parent_case_id as string | null | undefined) ?? null,
  };
}

function technicianPrimaryLabel(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "Teklif ver";
    case "appointment_pending":
      return "Randevuyu onayla";
    case "scheduled":
      return "İşe başla";
    case "service_in_progress":
      return "Durumu güncelle";
    case "parts_approval":
      return "Parça onayı bekleniyor";
    case "invoice_approval":
      return "Fatura bekleniyor";
    default:
      return "Vakayı aç";
  }
}

function fallbackTechnicianTitle(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "Yeni müşteri havuzu";
    case "appointment_pending":
      return "Randevu teklifi geldi";
    case "scheduled":
      return "Planlanmış iş";
    case "service_in_progress":
      return "Aktif iş";
    case "parts_approval":
      return "Müşteri onayı bekleniyor";
    case "invoice_approval":
      return "Fatura onayı bekleniyor";
    default:
      return "Vaka güncellemesi";
  }
}

function fallbackTechnicianDescription(status: ServiceCaseStatus): string {
  switch (status) {
    case "matching":
    case "offers_ready":
      return "Eşleşen havuzda teklif verebilirsin.";
    case "appointment_pending":
      return "Müşterinin önerdiği saati onayla veya karşı öner.";
    case "scheduled":
      return "Randevu saatinde iş başlat.";
    case "service_in_progress":
      return "Müşteriye süreç güncellemesi paylaş.";
    case "parts_approval":
      return "Müşteri parça talebine yanıt verecek.";
    case "invoice_approval":
      return "Müşteri faturayı onaylayacak.";
    default:
      return "Detaya geçerek durumu kontrol et.";
  }
}

function deriveTechnicianNextAction(detail: CaseDetailResponse) {
  const terminal = ["completed", "cancelled", "archived"].includes(detail.status);
  if (terminal) {
    return {
      next_action_title: "",
      next_action_description: "",
      next_action_primary_label: "",
      next_action_secondary_label: null,
    };
  }
  const next = detail.next_action;
  const waitingOnMe =
    next?.waiting_on_me ??
    (detail.wait_state_actor
      ? detail.wait_state_actor === "technician"
      : ["matching", "appointment_pending", "scheduled", "service_in_progress"].includes(
          detail.status,
        ));
  return {
    next_action_title:
      next?.label ??
      detail.wait_state_label ??
      (waitingOnMe ? fallbackTechnicianTitle(detail.status) : "Müşteri bekleniyor"),
    next_action_description:
      next?.description ??
      detail.wait_state_description ??
      fallbackTechnicianDescription(detail.status),
    next_action_primary_label: waitingOnMe
      ? technicianPrimaryLabel(detail.status)
      : "",
    next_action_secondary_label: "Süreci takip et",
  };
}

function appointmentToDomain(appointment: AppointmentWire): Appointment {
  const slotKind = appointment.slot_kind ?? "flexible";
  return {
    id: appointment.id,
    case_id: appointment.case_id,
    technician_id: appointment.technician_id,
    offer_id: appointment.offer_id ?? null,
    slot: {
      kind: slotKind,
      dateLabel:
        (appointment.slot.dateLabel as string | undefined) ??
        (appointment.slot.date_label as string | undefined),
      timeWindow:
        (appointment.slot.timeWindow as string | undefined) ??
        (appointment.slot.time_window as string | undefined),
    },
    note: appointment.note,
    status: appointment.status,
    requested_at: appointment.requested_at,
    expires_at: appointment.expires_at ?? appointment.requested_at,
    responded_at: appointment.responded_at ?? null,
    decline_reason: appointment.decline_reason ?? null,
  };
}

function buildCaseFromBundle(bundle: CanonicalJobBundle): ServiceCase {
  const { detail } = bundle;
  const approvals = bundle.approvals.map(approvalToDomain);
  const documents = bundle.documents.map((doc) => documentToDomain(doc, detail.id));
  const events = bundle.events
    .map(eventToDomain)
    .filter((event): event is CaseEvent => event !== null);
  const thread = buildThread(detail.id, bundle.messages);
  const request = buildRequestFromDetail(detail);
  const nextAction = deriveTechnicianNextAction(detail);
  const assignedTechnicianId =
    detail.assigned_technician_id ??
    ((detail.subtype as Record<string, unknown> | null | undefined)
      ?.assigned_technician_id as string | undefined) ??
    null;
  const appointment =
    bundle.appointments.find((item) => item.status === "pending") ??
    bundle.appointments[0] ??
    null;

  const primary: ServiceCase = {
    id: detail.id,
    vehicle_id: detail.vehicle_id,
    kind: detail.kind as ServiceRequestKind,
    status: detail.status as ServiceCaseStatus,
    title: detail.title,
    subtitle: nextAction.next_action_description,
    summary: detail.summary ?? "",
    created_at: detail.created_at,
    created_at_label: formatRelativeTurkish(detail.created_at),
    updated_at: detail.updated_at,
    updated_at_label: formatRelativeTurkish(detail.updated_at),
    request,
    assigned_technician_id: assignedTechnicianId,
    preferred_technician_id: null,
    next_action_title: nextAction.next_action_title,
    next_action_description: nextAction.next_action_description,
    next_action_primary_label: nextAction.next_action_primary_label,
    next_action_secondary_label: nextAction.next_action_secondary_label,
    total_label:
      priceLabel(detail.estimate_amount) ??
      approvals.find((item) => item.status === "pending")?.amount_label ??
      null,
    estimate_label: null,
    allowed_actions: [],
    pending_approvals: approvals.filter((item) => item.status === "pending"),
    assigned_service: null,
    documents,
    offers: [],
    attachments: [],
    events,
    thread,
    workflow_blueprint: detail.workflow_blueprint,
    milestones: [],
    tasks: [],
    evidence_feed: [],
    wait_state: {
      actor: detail.wait_state_actor ?? "system",
      label: detail.wait_state_label ?? "Süreç takipte",
      description:
        detail.wait_state_description ??
        "Vaka canlı backend üzerinden takip ediliyor.",
    },
    last_seen_by_actor: { customer: null, technician: null },
    notification_intents: [],
    appointment: appointment ? appointmentToDomain(appointment) : null,
    origin: "customer",
    insurance_claim: null,
    tow_stage:
      detail.kind === "towing"
        ? (((detail.subtype ?? {}) as Record<string, unknown>).tow_stage as
            | string
            | undefined) ?? null
        : null,
  };

  const synced = syncTrackingCase(primary);
  return {
    ...synced,
    wait_state: primary.wait_state,
    next_action_title: nextAction.next_action_title,
    next_action_description: nextAction.next_action_description,
    next_action_primary_label: nextAction.next_action_primary_label,
    next_action_secondary_label: nextAction.next_action_secondary_label,
    subtitle: nextAction.next_action_description || synced.subtitle,
  };
}

function buildCaseFromSummary(summary: TechnicianCaseSummary): ServiceCase {
  const detail: CaseDetailResponse = {
    id: summary.id,
    vehicle_id: summary.vehicle_id,
    kind: summary.kind,
    status: summary.status,
    urgency: summary.urgency,
    workflow_blueprint: summary.workflow_blueprint,
    title: summary.title,
    summary: summary.summary,
    subtitle: summary.subtitle,
    location_label: summary.location_label,
    created_at: summary.created_at,
    updated_at: summary.updated_at,
    vehicle_snapshot: null,
    subtype: {
      assigned_technician_id: summary.assigned_technician_id,
    },
    linked_tow_case_ids: [],
    customer_notes: null,
    estimate_amount: summary.estimate_amount,
    assigned_technician_id: summary.assigned_technician_id,
  };
  return buildCaseFromBundle({
    detail,
    approvals: [],
    documents: [],
    events: [],
    messages: [],
    appointments: [],
  });
}

export function buildServiceCaseFromPoolDetail(
  detail: PoolCaseDetail,
): ServiceCase {
  const now = detail.updated_at ?? detail.created_at;
  return buildCaseFromBundle({
    detail: {
      id: detail.id,
      vehicle_id: detail.vehicle_id,
      kind: detail.kind,
      status: detail.status,
      urgency: detail.urgency,
      workflow_blueprint: detail.workflow_blueprint,
      title: detail.title,
      summary: detail.summary,
      subtitle: detail.subtitle,
      location_label: detail.location_label,
      created_at: detail.created_at,
      updated_at: now,
      vehicle_snapshot: null,
      subtype: {},
      linked_tow_case_ids: [],
      customer_notes: null,
      estimate_amount: detail.estimate_amount,
      assigned_technician_id: null,
    },
    approvals: [],
    documents: [],
    events: [],
    messages: [],
    appointments: [],
  });
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function fetchCanonicalJobCase(caseId: string): Promise<ServiceCase> {
  const detailRaw = await apiClient(`/cases/${caseId}`);
  const detail = CaseDetailResponseSchema.parse(detailRaw);
  const [
    approvals,
    documents,
    events,
    messages,
    appointments,
  ] = await Promise.all([
    safeQuery(async () => {
      const raw = await apiClient(`/cases/${caseId}/approvals`);
      return z.array(ApprovalWireSchema).parse(raw);
    }, [] as ApprovalWire[]),
    safeQuery(async () => {
      const raw = await apiClient(`/cases/${caseId}/documents`);
      return CaseDocumentListResponseSchema.parse(raw).items;
    }, [] as CaseDocumentItem[]),
    safeQuery(async () => {
      const raw = await apiClient(`/cases/${caseId}/events?limit=100`);
      return CaseEventListResponseSchema.parse(raw).items;
    }, [] as CaseEventItem[]),
    safeQuery(async () => {
      const raw = await apiClient(`/cases/${caseId}/thread/messages?limit=100`);
      return ThreadMessageListResponseSchema.parse(raw).items;
    }, [] as ThreadMessageResponse[]),
    safeQuery(async () => {
      const raw = await apiClient(`/appointments/case/${caseId}`);
      return AppointmentListResponseSchema.parse(raw);
    }, [] as AppointmentWire[]),
  ]);

  return buildCaseFromBundle({
    detail,
    approvals,
    documents,
    events,
    messages,
    appointments,
  });
}

export async function fetchPoolOrCanonicalCase(
  caseId: string,
): Promise<ServiceCase> {
  try {
    const raw = await apiClient(`/pool/case/${caseId}`);
    return buildServiceCaseFromPoolDetail(PoolCaseDetailSchema.parse(raw));
  } catch {
    return fetchCanonicalJobCase(caseId);
  }
}

async function invalidateJobConsumers(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["jobs", "live"] }),
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
    queryClient.invalidateQueries({ queryKey: ["approvals"] }),
    queryClient.invalidateQueries({ queryKey: ["pool"] }),
    queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    queryClient.invalidateQueries({ queryKey: ["technicians"] }),
  ]);
}

function approvalPayload(input: {
  kind: "parts_request" | "invoice" | "completion";
  title: string;
  description?: string | null;
  amount?: string | null;
  service_comment?: string | null;
  line_items?: ApprovalLineItem[];
  delivery_report?: Record<string, unknown> | null;
  public_showcase_consent?: boolean;
  public_showcase_media_ids?: string[];
}) {
  return {
    currency: "TRY",
    line_items: [],
    public_showcase_consent: false,
    public_showcase_media_ids: [],
    ...input,
  };
}

export function useJobsFeed() {
  return useQuery<ServiceCase[]>({
    queryKey: ["jobs", "live", "feed"],
    queryFn: async () => {
      const raw = await apiClient("/technicians/me/cases");
      return TechnicianCaseSummaryListSchema.parse(raw).map(buildCaseFromSummary);
    },
    staleTime: 15 * 1000,
  });
}

export function useIncomingAppointments() {
  const jobs = useJobsFeed();
  return {
    ...jobs,
    data:
      jobs.data?.filter(
        (caseItem) => caseItem.status === "appointment_pending",
      ) ?? [],
  };
}

export function usePoolCaseDetail(caseId: string) {
  return useQuery<ServiceCase | null>({
    queryKey: ["jobs", "live", "pool-or-case-detail", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => fetchPoolOrCanonicalCase(caseId),
    staleTime: 15 * 1000,
  });
}

export function useJobDetail(caseId: string) {
  return useQuery<ServiceCase | null>({
    queryKey: ["jobs", "live", "detail", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => fetchCanonicalJobCase(caseId),
    staleTime: 10 * 1000,
  });
}

export function useTechnicianTrackingJob(caseId: string) {
  const query = useJobDetail(caseId);
  const data = useMemo(
    () => (query.data ? buildTechnicianTrackingView(query.data) : null),
    [query.data],
  );
  return { ...query, data };
}

export function useJobTask(caseId: string, taskId: string) {
  const query = useJobDetail(caseId);
  const data = useMemo(
    () => query.data?.tasks.find((task) => task.id === taskId) ?? null,
    [query.data, taskId],
  );
  return { ...query, data };
}

export function useJobThread(caseId: string) {
  const query = useJobDetail(caseId);
  const data = useMemo(() => query.data?.thread ?? null, [query.data]);
  return { ...query, data };
}

export function useMarkJobSeen(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!caseId) return null;
      await apiClient(`/cases/${caseId}/thread/seen`, { method: "POST" });
      await invalidateJobConsumers(queryClient);
      return null;
    },
  });
}

export function useAddJobEvidence(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      attachment,
      note,
    }: {
      taskId: string;
      attachment: CaseAttachment;
      note?: string;
    }) => {
      const body = {
        title: attachment.title,
        kind: attachment.kind,
        source_label: "Usta uygulaması",
        status_label: attachment.statusLabel ?? "Yüklendi",
        subtitle: note?.trim() || attachment.subtitle || null,
        media_asset_id: attachment.asset?.id ?? null,
        requirement_id: taskId || null,
      };
      const result = await apiClient(`/cases/${caseId}/evidence`, {
        method: "POST",
        body,
      });
      await invalidateJobConsumers(queryClient);
      return result;
    },
  });
}

export function useShareJobStatusUpdate(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note: string) => {
      const result = await apiClient(`/cases/${caseId}/status-updates`, {
        method: "POST",
        body: { note },
      });
      await invalidateJobConsumers(queryClient);
      return result;
    },
  });
}

export function useRequestJobPartsApproval(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PartsApprovalInput) => {
      const lineItems = input.lineItems.map((item) => {
        const qty = toFiniteNumber(item.qty || "1") || 1;
        const unit = toFiniteNumber(item.unit);
        return {
          label: item.label.trim(),
          value: `${qty} x ${priceLabel(unit) ?? `${unit} ₺`}`,
          note: input.note?.trim() || null,
        };
      });
      const amount =
        decimalString(input.amount) ??
        decimalString(
          input.lineItems.reduce(
            (sum, item) =>
              sum +
              (toFiniteNumber(item.qty || "1") || 1) * toFiniteNumber(item.unit),
            0,
          ),
        );
      const raw = await apiClient(`/cases/${caseId}/approvals`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(approvalPayload({
          kind: "parts_request",
          title: "Parça/kapsam onayı",
          description:
            input.note?.trim() ||
            "Servis parça veya kapsam değişikliği için müşteri onayı istiyor.",
          amount,
          service_comment: input.note?.trim() || null,
          line_items: lineItems,
        }))),
      });
      await invalidateJobConsumers(queryClient);
      return ApprovalWireSchema.parse(raw);
    },
  });
}

export function useShareJobInvoice(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InvoiceApprovalInput) => {
      const amount = decimalString(input.amount);
      const raw = await apiClient(`/cases/${caseId}/approvals`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(approvalPayload({
          kind: "invoice",
          title: input.title.trim(),
          description: input.note?.trim() || input.title.trim(),
          amount,
          service_comment: input.note?.trim() || null,
          line_items: amount
            ? [
                {
                  label: input.title.trim(),
                  value: priceLabel(amount) ?? amount,
                  note: input.note?.trim() || null,
                },
              ]
            : [],
        }))),
      });
      await invalidateJobConsumers(queryClient);
      return ApprovalWireSchema.parse(raw);
    },
  });
}

function deliveryLineItems(report?: DeliveryReportPayload): ApprovalLineItem[] {
  if (!report) return [];
  const rows: ApprovalLineItem[] = [];
  if (report.currentKm != null) {
    rows.push({
      label: "Teslim kilometresi",
      value: `${report.currentKm.toLocaleString("tr-TR")} km`,
    });
  }
  rows.push({ label: "İşlem tarihi", value: report.serviceDate });
  rows.push({ label: "Yapılan işlem", value: report.workSummary });
  if (report.nextServiceKm != null) {
    rows.push({
      label: "Sonraki bakım",
      value: `${report.nextServiceKm.toLocaleString("tr-TR")} km`,
    });
  }
  if (report.warrantyNote) {
    rows.push({ label: "Garanti / dikkat", value: report.warrantyNote });
  }
  if (report.customerNote) {
    rows.push({ label: "Teslim notu", value: report.customerNote });
  }
  return rows;
}

export function useMarkReadyForDelivery(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (report?: DeliveryReportPayload) => {
      const raw = await apiClient(`/cases/${caseId}/approvals`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(approvalPayload({
          kind: "completion",
          title: "Son teslim raporu",
          description:
            report?.workSummary ??
            "Servis son teslim raporunu müşteri onayına gönderdi.",
          service_comment: report?.customerNote ?? report?.warrantyNote ?? null,
          line_items: deliveryLineItems(report),
          delivery_report: report
            ? {
                current_km: report.currentKm,
                service_date: report.serviceDate,
                next_service_km: report.nextServiceKm,
                work_summary: report.workSummary,
                warranty_note: report.warrantyNote ?? null,
                customer_note: report.customerNote ?? null,
              }
            : null,
          public_showcase_consent: report?.publicShowcaseConsent ?? false,
          public_showcase_media_ids: report?.publicShowcaseMediaIds ?? [],
        }))),
      });
      await invalidateJobConsumers(queryClient);
      return ApprovalWireSchema.parse(raw);
    },
  });
}

export function useSendJobMessage(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const raw = await apiClient(`/cases/${caseId}/thread/messages`, {
        method: "POST",
        body: { content: body },
      });
      await invalidateJobConsumers(queryClient);
      return ThreadMessageResponseSchema.parse(raw);
    },
  });
}

export function useApproveIncomingAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (caseId: string) => {
      const raw = await apiClient(`/appointments/case/${caseId}`);
      const appointment = AppointmentListResponseSchema.parse(raw).find(
        (item) => item.status === "pending",
      );
      if (!appointment) {
        throw new Error("Bu vaka için bekleyen randevu bulunamadı.");
      }
      const result = await apiClient(`/appointments/${appointment.id}/approve`, {
        method: "POST",
      });
      await invalidateJobConsumers(queryClient);
      return AppointmentWireSchema.parse(result);
    },
  });
}

export function useDeclineIncomingAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; reason?: string }) => {
      const raw = await apiClient(`/appointments/case/${input.caseId}`);
      const appointment = AppointmentListResponseSchema.parse(raw).find(
        (item) => item.status === "pending",
      );
      if (!appointment) {
        throw new Error("Bu vaka için bekleyen randevu bulunamadı.");
      }
      const result = await apiClient(`/appointments/${appointment.id}/decline`, {
        method: "POST",
        body: { reason: input.reason || "Usta müsait değil" },
      });
      await invalidateJobConsumers(queryClient);
      return AppointmentWireSchema.parse(result);
    },
  });
}
