import type {
  CaseApproval,
  CaseAttachment,
  CaseDocument,
  CaseEvent,
  CaseEventType as FeCaseEventType,
  CaseMessage,
  CaseOffer,
  CaseOfferStatus,
  CaseThread,
  ServiceCase,
  ServiceCaseStatus,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import { syncTrackingCase } from "@naro/mobile-core";
import { useMemo } from "react";

import { useCaseApprovals } from "@/features/approvals";
import type { ApprovalResponse } from "@/features/approvals/schemas";
import { useCaseOffers } from "@/features/offers";
import type { OfferResponse } from "@/features/offers/schemas";

import {
  flattenCaseEvents,
  useCaseDetailLive,
  useCaseDocumentsLive,
  useCaseEventsLive,
  useCaseThreadLive,
} from "../api";
import type { CaseDetailResponse } from "../schemas/case-create";
import type { ThreadMessageResponse } from "../schemas/thread";
import type {
  CaseDocumentItem,
  CaseEventItem,
  CaseEventType as BeCaseEventType,
} from "../schemas/timeline";

/**
 * Canonical case adapter — İş B iter 2 Chunk 2 (2026-04-23).
 *
 * BE canonical endpoint'lerinin birleşik okumasını mock `ServiceCase`
 * shape'ine projekte eder. Engine.ts (`syncTrackingCase`) bu shape'i
 * değiştirmeden kullanır; milestones/tasks/evidence_feed/next_action/
 * wait_state/notification_intents eski derivation motoruyla üretilir.
 *
 * Adapter scope:
 * - Primary fields: CaseDetailResponse (shell + subtype + snapshot +
 *   linkage + customer_notes)
 * - Offers: useCaseOffers (live)
 * - Pending approvals: useCaseApprovals (live; engine filtreliyor)
 * - Documents: useCaseDocumentsLive (live)
 * - Events: useCaseEventsLive (infinite; flatten ASC)
 * - Thread: useCaseThreadLive (infinite; preview = son mesaj)
 *
 * request_draft: artık `matching` input kaynağı DEĞİL. Sadece trace/
 * snapshot olarak subtype + detail shell'den türetilmiş minimum
 * alanlarla doldurulur. Mock composer mutasyonları bu adapter yerine
 * `useCasesStore.getDraft` okumaya devam eder.
 *
 * V1.1 TODO (backlog):
 * - Appointment: `useCaseAppointments(caseId)` projeksiyonu (şimdilik
 *   null; AppointmentRequest/Countdown hook'ları ayrı mock)
 * - Insurance claim: ayrı BE endpoint (yok); null
 * - assigned_service snapshot: engine `getTrackingServiceSnapshot`
 *   fallback'i zaten assigned_technician_id'den mock turlaması yapıyor
 */
export type CanonicalCaseResult = {
  data: ServiceCase | null;
  isPending: boolean;
  isError: boolean;
  errors: unknown[];
  refetch: () => void;
};

const BE_TO_FE_EVENT_TYPE: Partial<Record<BeCaseEventType, FeCaseEventType>> = {
  submitted: "submitted",
  offer_received: "offer_received",
  technician_selected: "technician_selected",
  status_update: "status_update",
  parts_requested: "parts_requested",
  invoice_shared: "invoice_shared",
  message: "message",
  completed: "completed",
};

const BE_TO_FE_ATTACHMENT_KIND: Record<
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

function toFiniteNumber(input: string): number {
  const parsed = Number.parseFloat(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function offerToDomain(offer: OfferResponse): CaseOffer {
  const amount = toFiniteNumber(offer.amount);
  return {
    id: offer.id,
    technician_id: offer.technician_id,
    headline: offer.headline,
    description: offer.description ?? "",
    amount,
    currency: offer.currency,
    price_label: `${amount.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${offer.currency === "TRY" ? "₺" : offer.currency}`,
    eta_minutes: offer.eta_minutes,
    eta_label: offer.eta_minutes > 0 ? `${offer.eta_minutes} dk` : "—",
    available_at_label: offer.available_at_label ?? "",
    delivery_mode: offer.delivery_mode,
    warranty_label: offer.warranty_label,
    status: offer.status as CaseOfferStatus,
    badges: offer.badges,
  };
}

function approvalToDomain(approval: ApprovalResponse): CaseApproval {
  const amountLabel = approval.amount
    ? `${toFiniteNumber(approval.amount).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${approval.currency === "TRY" ? "₺" : approval.currency}`
    : null;
  return {
    id: approval.id,
    kind: approval.kind,
    status: approval.status,
    title:
      approval.kind === "parts_request"
        ? "Ek parça onayı"
        : approval.kind === "invoice"
          ? "Fatura onayı"
          : "Tamamlama onayı",
    description: approval.description ?? "",
    requested_by: approval.kind === "completion" ? "Usta" : "Servis",
    requested_at: approval.created_at,
    requested_at_label: formatRelativeTurkish(approval.created_at),
    amount_label: amountLabel,
    action_label: null,
    service_comment: approval.resolver_note ?? undefined,
    line_items: approval.line_items.map((item, index) => ({
      id: `${approval.id}-line-${index}`,
      label: item.label,
      value: item.value,
      note: item.note ?? undefined,
    })),
    evidence_document_ids: [],
  };
}

function documentToDomain(doc: CaseDocumentItem): CaseDocument {
  return {
    id: doc.id,
    kind: BE_TO_FE_ATTACHMENT_KIND[doc.kind],
    title: doc.title,
    subtitle: doc.mime_type,
    source_label:
      doc.uploader_role === "customer"
        ? "Sen"
        : doc.uploader_role === "technician"
          ? "Usta"
          : "Sistem",
    status_label:
      doc.antivirus_verdict === "clean"
        ? "Temiz"
        : doc.antivirus_verdict === "pending"
          ? "Taranıyor"
          : "Güvensiz",
    created_at: doc.uploaded_at,
    created_at_label: formatRelativeTurkish(doc.uploaded_at),
    asset: null,
  };
}

function eventToDomain(event: CaseEventItem): CaseEvent | null {
  const feType = BE_TO_FE_EVENT_TYPE[event.type];
  if (!feType) return null;
  return {
    id: event.id,
    type: feType,
    title: event.title,
    body: event.body ?? "",
    created_at: event.created_at,
    created_at_label: formatRelativeTurkish(event.created_at),
    tone: event.tone,
  };
}

function threadMessageToDomain(
  message: ThreadMessageResponse,
  attachments: CaseAttachment[] = [],
): CaseMessage {
  return {
    id: message.id,
    author_name: message.sender_role === "customer" ? "Sen" : "Usta",
    author_role: message.sender_role,
    body: message.content,
    created_at: message.created_at,
    created_at_label: formatClock(message.created_at),
    attachments,
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
    messages: sorted.map((m) => threadMessageToDomain(m)),
  };
}

function buildRequestFromSubtype(
  detail: CaseDetailResponse,
): ServiceRequestDraft {
  const subtype = (detail.subtype ?? {}) as Record<string, unknown>;
  const snapshot = detail.vehicle_snapshot;
  // Subtype attachment listesi BE response'ta exposed değil (v1).
  // request.attachments mock akış için boş kalır; canonical documents
  // `useCaseDocumentsLive`'dan zaten ayrı geliyor.
  const base: ServiceRequestDraft = {
    kind: detail.kind,
    vehicle_id: snapshot?.plate ?? "",
    urgency: (detail.urgency as ServiceRequestDraft["urgency"]) ?? "planned",
    summary: detail.summary ?? "",
    location_label: detail.location_label ?? "",
    dropoff_label: (subtype.dropoff_address as string | undefined) ?? undefined,
    notes: detail.customer_notes ?? undefined,
    attachments: [],
    symptoms: (subtype.symptoms as string[] | undefined) ?? [],
    maintenance_items:
      (subtype.maintenance_items as string[] | undefined) ?? [],
    preferred_window:
      (subtype.scheduled_at as string | undefined) ?? undefined,
    vehicle_drivable:
      (subtype.vehicle_drivable as boolean | null | undefined) ?? null,
    towing_required: false,
    pickup_preference:
      (subtype.pickup_preference as ServiceRequestDraft["pickup_preference"]) ??
      null,
    mileage_km: (subtype.mileage_km as number | null | undefined) ?? null,
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
    maintenance_detail: null,
    maintenance_tier:
      (subtype.maintenance_tier as string | undefined) ?? undefined,
  };
  return base;
}

function deriveAssignedTechnicianId(
  offers: CaseOffer[],
  subtype: Record<string, unknown>,
): string | null {
  const assigned = (subtype.assigned_technician_id as string | undefined) ?? null;
  if (assigned) return assigned;
  const accepted = offers.find((o) => o.status === "accepted");
  return accepted?.technician_id ?? null;
}

function derivePreferredTechnicianId(offers: CaseOffer[]): string | null {
  const shortlisted = offers.find((o) => o.status === "shortlisted");
  return shortlisted?.technician_id ?? null;
}

export function useCanonicalCase(caseId: string): CanonicalCaseResult {
  const detailQuery = useCaseDetailLive(caseId);
  const offersQuery = useCaseOffers(caseId);
  const approvalsQuery = useCaseApprovals(caseId);
  const documentsQuery = useCaseDocumentsLive(caseId);
  const eventsQuery = useCaseEventsLive(caseId);
  const threadQuery = useCaseThreadLive(caseId);

  const data = useMemo<ServiceCase | null>(() => {
    const detail = detailQuery.data;
    if (!detail) return null;

    const offers = (offersQuery.data ?? []).map(offerToDomain);
    const approvals = (approvalsQuery.data ?? []).map(approvalToDomain);
    const documents = (documentsQuery.data ?? []).map(documentToDomain);
    const events = flattenCaseEvents(eventsQuery.data)
      .map(eventToDomain)
      .filter((e): e is CaseEvent => e !== null);
    const threadMessages =
      threadQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const thread = buildThread(detail.id, threadMessages);
    const subtype = (detail.subtype ?? {}) as Record<string, unknown>;

    const request = buildRequestFromSubtype(detail);
    const assignedTechnicianId = deriveAssignedTechnicianId(offers, subtype);
    const preferredTechnicianId = derivePreferredTechnicianId(offers);

    // Initial ServiceCase (syncTrackingCase bunu rich shape'e doldurur).
    const primary: ServiceCase = {
      id: detail.id,
      vehicle_id: detail.vehicle_snapshot?.plate ?? "",
      kind: detail.kind as ServiceRequestKind,
      status: detail.status as ServiceCaseStatus,
      title: detail.title,
      subtitle: "",
      summary: detail.summary ?? "",
      created_at: detail.created_at,
      created_at_label: formatRelativeTurkish(detail.created_at),
      updated_at: detail.updated_at,
      updated_at_label: formatRelativeTurkish(detail.updated_at),
      request,
      assigned_technician_id: assignedTechnicianId,
      preferred_technician_id: preferredTechnicianId,
      next_action_title: "",
      next_action_description: "",
      next_action_primary_label: "",
      next_action_secondary_label: null,
      total_label:
        offers[0]?.price_label ??
        approvals.find((a) => a.status === "pending")?.amount_label ??
        null,
      estimate_label: offers[0]?.eta_label ?? null,
      allowed_actions: [],
      pending_approvals: approvals.filter((a) => a.status === "pending"),
      assigned_service: null,
      documents,
      offers,
      attachments: [],
      events,
      thread,
      workflow_blueprint: "maintenance_standard",
      milestones: [],
      tasks: [],
      evidence_feed: [],
      wait_state: {
        actor: "system",
        label: "Sistem çalışıyor",
        description: "Süreç platform tarafında toparlanıyor.",
      },
      last_seen_by_actor: { customer: null, technician: null },
      notification_intents: [],
      appointment: null,
      origin: "customer",
      insurance_claim: null,
    };

    return syncTrackingCase(primary);
  }, [
    detailQuery.data,
    offersQuery.data,
    approvalsQuery.data,
    documentsQuery.data,
    eventsQuery.data,
    threadQuery.data,
  ]);

  const isPending =
    detailQuery.isPending ||
    offersQuery.isPending ||
    approvalsQuery.isPending ||
    documentsQuery.isPending ||
    eventsQuery.isPending ||
    threadQuery.isPending;
  const isError =
    detailQuery.isError ||
    offersQuery.isError ||
    approvalsQuery.isError ||
    documentsQuery.isError ||
    eventsQuery.isError ||
    threadQuery.isError;
  const errors = [
    detailQuery.error,
    offersQuery.error,
    approvalsQuery.error,
    documentsQuery.error,
    eventsQuery.error,
    threadQuery.error,
  ].filter((e): e is Error => e != null);

  const refetch = () => {
    void detailQuery.refetch();
    void offersQuery.refetch();
    void approvalsQuery.refetch();
    void documentsQuery.refetch();
    void eventsQuery.refetch();
    void threadQuery.refetch();
  };

  return { data, isPending, isError, errors, refetch };
}
