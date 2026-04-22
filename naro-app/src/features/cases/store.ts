import type {
  CaseAttachment,
  CaseOfferStatus,
  ServiceCase,
  ServiceCaseStatus,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import type { AppointmentRequestPayload } from "@naro/mobile-core";
import {
  appendCaseAttachment,
  approveAppointmentForCase,
  approveCaseInvoice,
  approveCaseParts,
  attachTechnicianToTrackingCase,
  cancelAppointmentForCase,
  cancelCaseByCustomer,
  confirmCaseAppointment,
  confirmCaseCompletion,
  createTrackingDraftForKind,
  declineAppointmentForCase,
  expireAppointmentForCase,
  getTrackingServiceSnapshot,
  markCaseSeen,
  refreshMatchingCase,
  rejectOfferForCase,
  requestAppointmentForCase,
  seedTrackingCases,
  selectOfferForCase,
  sendCaseMessage,
  shortlistOfferForCase,
  syncTrackingCase,
  trackingServiceDirectory,
  updateCaseNotes,
} from "@naro/mobile-core";
import { create } from "zustand";

import { mockVehicles } from "@/features/vehicles/data/fixtures";

type CasesState = {
  cases: ServiceCase[];
  drafts: Partial<Record<ServiceRequestKind, ServiceRequestDraft>>;
  getDraft: (kind: ServiceRequestKind, vehicleId: string) => ServiceRequestDraft;
  updateDraft: (
    kind: ServiceRequestKind,
    patch: Partial<ServiceRequestDraft>,
  ) => ServiceRequestDraft;
  resetDraft: (kind: ServiceRequestKind, vehicleId: string) => ServiceRequestDraft;
  submitDraft: (
    kind: ServiceRequestKind,
    vehicleId: string,
    override?: { id?: string; status?: ServiceCaseStatus },
  ) => ServiceCase;
  refreshMatching: (caseId: string) => ServiceCase | null;
  selectOffer: (caseId: string, offerId: string) => ServiceCase | null;
  shortlistOffer: (caseId: string, offerId: string) => ServiceCase | null;
  rejectOffer: (caseId: string, offerId: string) => ServiceCase | null;
  confirmAppointment: (caseId: string) => ServiceCase | null;
  approvePartsRequest: (
    caseId: string,
    approvalId: string,
  ) => ServiceCase | null;
  approveInvoice: (caseId: string, approvalId: string) => ServiceCase | null;
  confirmCompletion: (
    caseId: string,
    approvalId: string,
  ) => ServiceCase | null;
  sendMessage: (
    caseId: string,
    body: string,
    attachments?: CaseAttachment[],
  ) => ServiceCase | null;
  markSeen: (caseId: string) => ServiceCase | null;
  attachTechnician: (caseId: string, technicianId: string) => ServiceCase | null;
  prefillDraftTechnician: (
    kind: ServiceRequestKind,
    vehicleId: string,
    technicianId: string,
  ) => ServiceRequestDraft;
  requestAppointment: (
    caseId: string,
    payload: AppointmentRequestPayload,
  ) => ServiceCase | null;
  approveAppointment: (caseId: string) => ServiceCase | null;
  declineAppointment: (caseId: string, reason?: string) => ServiceCase | null;
  expireAppointment: (caseId: string) => ServiceCase | null;
  cancelAppointment: (caseId: string) => ServiceCase | null;
  cancelCase: (caseId: string, reason?: string) => ServiceCase | null;
  addAttachment: (
    caseId: string,
    attachment: CaseAttachment,
  ) => ServiceCase | null;
  updateNotes: (
    caseId: string,
    patch: { summary?: string; notes?: string },
  ) => ServiceCase | null;
};

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function nowLabel() {
  return "Az once";
}

function buildOffer(
  technicianId: string,
  index: number,
  preferredTechnicianId: string | null,
) {
  const profile =
    trackingServiceDirectory[
      technicianId as keyof typeof trackingServiceDirectory
    ];
  const amount = [1850, 2400, 3200][index] ?? 2400;
  const etaMinutes = [90, 120, 180][index] ?? 120;
  const status: CaseOfferStatus =
    preferredTechnicianId === technicianId ? "shortlisted" : "pending";

  return {
    id: nextId("offer"),
    technician_id: technicianId,
    headline: profile?.reason ?? "Vaka icin teklif hazir",
    description:
      "Fiyat, teslim modu ve guvence ayni karar ekraninda karsilastirilir.",
    amount,
    currency: "TRY",
    price_label: `₺${amount.toLocaleString("tr-TR")}`,
    eta_minutes: etaMinutes,
    eta_label: etaMinutes < 60 ? `~${etaMinutes} dk` : `~${etaMinutes / 60} sa`,
    available_at_label: "Hazir",
    delivery_mode: profile?.service_mode ?? "Atolye kabul",
    warranty_label: profile?.guarantee ?? "Yazili garanti",
    status,
    badges: [...(profile?.badges ?? [])],
  };
}

function buildCaseTitle(draft: ServiceRequestDraft) {
  switch (draft.kind) {
    case "accident":
      return draft.damage_area
        ? `Kaza bildirimi · ${draft.damage_area}`
        : "Kaza bildirimi";
    case "towing":
      return "Yolda kalma ve cekici talebi";
    case "breakdown":
      return draft.summary || "Ariza talebi";
    case "maintenance":
      return "Planli bakim talebi";
  }
}

function buildCaseSummary(draft: ServiceRequestDraft) {
  return [draft.location_label, draft.preferred_window, draft.notes]
    .filter(Boolean)
    .join(" · ");
}

function buildCreatedCase(
  kind: ServiceRequestKind,
  vehicleId: string,
  draft: ServiceRequestDraft,
): ServiceCase {
  const caseId = nextId("case");
  const preferredTechnicianId = draft.preferred_technician_id;
  const offers = Object.keys(trackingServiceDirectory).map((technicianId, index) =>
    buildOffer(technicianId, index, preferredTechnicianId),
  );
  const status: ServiceCaseStatus =
    kind === "accident" || kind === "towing" ? "matching" : "offers_ready";

  return syncTrackingCase({
    id: caseId,
    vehicle_id: vehicleId,
    kind,
    status,
    title: buildCaseTitle(draft),
    subtitle: "",
    summary: buildCaseSummary(draft),
    created_at: nowIso(),
    created_at_label: "Az once",
    updated_at: nowIso(),
    updated_at_label: "Az once",
    request: draft,
    assigned_technician_id: null,
    preferred_technician_id: preferredTechnicianId,
    next_action_title: "",
    next_action_description: "",
    next_action_primary_label: "",
    next_action_secondary_label: null,
    total_label: offers[0]?.price_label ?? null,
    estimate_label: offers[0]?.eta_label ?? null,
    allowed_actions: [],
    pending_approvals: [],
    assigned_service: getTrackingServiceSnapshot(
      preferredTechnicianId,
      preferredTechnicianId ? "Talep bu servisle baslatildi" : undefined,
    ),
    documents: draft.attachments.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      source_label: "Talep eki",
      status_label: item.statusLabel ?? "Hazir",
      created_at: nowIso(),
      created_at_label: nowLabel(),
      asset: item.asset ?? null,
    })),
    offers,
    attachments: draft.attachments,
    events: [
      {
        id: nextId("event"),
        type: "submitted",
        title: "Talep acildi",
        body: "Guided composer brief'i yeni bir vakaya donustu.",
        created_at: nowIso(),
        created_at_label: "Az once",
        tone: "info",
      },
    ],
    thread: {
      id: nextId("thread"),
      case_id: caseId,
      preview: "Talep basariyla acildi.",
      unread_count: 0,
      messages: [
        {
          id: nextId("message"),
          author_name: "Naro",
          author_role: "system",
          body: "Talebin alindi. Uygun servisler ve takip gorevleri hazirlaniyor.",
          created_at: nowIso(),
          created_at_label: "Az once",
          attachments: [],
        },
      ],
    },
    workflow_blueprint:
      kind === "maintenance" ? "maintenance_standard" : "damage_uninsured",
    milestones: [],
    tasks: [],
    evidence_feed: [],
    wait_state: {
      actor: "system",
      label: "Platform hazirlaniyor",
      description: "Ilk akisi kuruyoruz.",
    },
    last_seen_by_actor: {
      customer: null,
      technician: null,
    },
    notification_intents: [],
    appointment: null,
    origin: "customer",
    insurance_claim: null,
  });
}

function updateCaseById(
  cases: ServiceCase[],
  caseId: string,
  updater: (caseItem: ServiceCase) => ServiceCase,
) {
  let updatedCase: ServiceCase | null = null;

  return {
    updatedCase,
    cases: cases.map((caseItem) => {
      if (caseItem.id !== caseId) {
        return caseItem;
      }

      updatedCase = updater(caseItem);
      return updatedCase;
    }),
  };
}

export const useCasesStore = create<CasesState>((set, get) => ({
  cases: seedTrackingCases(),
  drafts: {},
  getDraft: (kind, vehicleId) => {
    const currentDraft = get().drafts[kind];

    if (currentDraft && currentDraft.vehicle_id === vehicleId) {
      return currentDraft;
    }

    const nextDraft = createTrackingDraftForKind(kind, vehicleId);
    set((state) => ({
      drafts: {
        ...state.drafts,
        [kind]: nextDraft,
      },
    }));
    return nextDraft;
  },
  updateDraft: (kind, patch) => {
    const currentDraft =
      get().drafts[kind] ?? createTrackingDraftForKind(kind, mockVehicles[0]!.id);
    const nextDraft = {
      ...currentDraft,
      ...patch,
    };

    set((state) => ({
      drafts: {
        ...state.drafts,
        [kind]: nextDraft,
      },
    }));

    return nextDraft;
  },
  resetDraft: (kind, vehicleId) => {
    const nextDraft = createTrackingDraftForKind(kind, vehicleId);
    set((state) => ({
      drafts: {
        ...state.drafts,
        [kind]: nextDraft,
      },
    }));
    return nextDraft;
  },
  submitDraft: (kind, vehicleId, override) => {
    const draft = get().drafts[kind] ?? createTrackingDraftForKind(kind, vehicleId);
    let createdCase = buildCreatedCase(kind, vehicleId, draft);
    if (override?.id || override?.status) {
      createdCase = {
        ...createdCase,
        ...(override.id ? { id: override.id } : {}),
        ...(override.status ? { status: override.status } : {}),
      };
    }

    set((state) => ({
      cases: [createdCase, ...state.cases],
      drafts: {
        ...state.drafts,
        [kind]: createTrackingDraftForKind(kind, vehicleId),
      },
    }));

    return createdCase;
  },
  refreshMatching: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, refreshMatchingCase);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  selectOffer: (caseId, offerId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        selectOfferForCase(caseItem, offerId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  shortlistOffer: (caseId, offerId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        shortlistOfferForCase(caseItem, offerId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  rejectOffer: (caseId, offerId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        rejectOfferForCase(caseItem, offerId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  confirmAppointment: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, confirmCaseAppointment);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  approvePartsRequest: (caseId, approvalId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        approveCaseParts(caseItem, approvalId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  approveInvoice: (caseId, approvalId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        approveCaseInvoice(caseItem, approvalId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  confirmCompletion: (caseId, approvalId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        confirmCaseCompletion(caseItem, approvalId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  sendMessage: (caseId, body, attachments = []) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        sendCaseMessage(caseItem, "customer", body, attachments),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  markSeen: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        markCaseSeen(caseItem, "customer"),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  attachTechnician: (caseId, technicianId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        attachTechnicianToTrackingCase(caseItem, technicianId),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  prefillDraftTechnician: (kind, vehicleId, technicianId) => {
    const baseDraft = get().getDraft(kind, vehicleId);
    const nextDraft = {
      ...baseDraft,
      preferred_technician_id: technicianId,
    };

    set((state) => ({
      drafts: {
        ...state.drafts,
        [kind]: nextDraft,
      },
    }));

    return nextDraft;
  },
  requestAppointment: (caseId, payload) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        requestAppointmentForCase(caseItem, payload),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  approveAppointment: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, approveAppointmentForCase);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  declineAppointment: (caseId, reason) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        declineAppointmentForCase(caseItem, reason),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  expireAppointment: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, expireAppointmentForCase);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  cancelAppointment: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, cancelAppointmentForCase);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  cancelCase: (caseId, reason) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        cancelCaseByCustomer(caseItem, reason),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  addAttachment: (caseId, attachment) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        appendCaseAttachment(caseItem, attachment),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  updateNotes: (caseId, patch) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        updateCaseNotes(caseItem, patch),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
}));
