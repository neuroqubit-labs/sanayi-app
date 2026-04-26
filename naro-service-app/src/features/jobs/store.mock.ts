import type {
  CaseAttachment,
  ProviderType,
  ServiceCase,
  ServiceRequestKind,
} from "@naro/domain";
import {
  addTechnicianEvidenceToCase,
  approveAppointmentForCase,
  cancelAppointmentForCase,
  createTechnicianInsuranceCase,
  declineAppointmentForCase,
  markCaseReadyForDelivery,
  markCaseSeen,
  PRIMARY_TECHNICIAN_ID,
  requestTechnicianPartsApproval,
  seedTrackingCases,
  sendCaseMessage,
  shareTechnicianInvoice,
  shareTechnicianStatusUpdate,
  type DeliveryReportPayload,
  submitOfferForCase,
  type OfferSubmissionPayload,
  type TechnicianInsuranceCasePayload,
} from "@naro/mobile-core";
import { create } from "zustand";

type JobsState = {
  technicianId: string;
  cases: ServiceCase[];
  markSeen: (caseId: string) => ServiceCase | null;
  addEvidence: (
    caseId: string,
    taskId: string,
    attachment: CaseAttachment,
    note?: string,
  ) => ServiceCase | null;
  shareStatusUpdate: (caseId: string, note: string) => ServiceCase | null;
  requestPartsApproval: (caseId: string) => ServiceCase | null;
  shareInvoice: (caseId: string) => ServiceCase | null;
  markReadyForDelivery: (
    caseId: string,
    report?: DeliveryReportPayload,
  ) => ServiceCase | null;
  sendMessage: (caseId: string, body: string) => ServiceCase | null;
  submitOffer: (
    caseId: string,
    payload: OfferSubmissionPayload,
  ) => ServiceCase | null;
  approveAppointment: (caseId: string) => ServiceCase | null;
  declineAppointment: (caseId: string, reason?: string) => ServiceCase | null;
  cancelAppointment: (caseId: string) => ServiceCase | null;
  createInsuranceCase: (payload: TechnicianInsuranceCasePayload) => ServiceCase;
};

export function isRelevantToTechnician(
  caseItem: ServiceCase,
  technicianId: string,
) {
  return Boolean(
    caseItem.assigned_technician_id === technicianId ||
      caseItem.offers.some((offer) => offer.technician_id === technicianId),
  );
}

export function isAvailableInPool(
  caseItem: ServiceCase,
  technicianId: string,
  providerType?: ProviderType,
) {
  const openStatus =
    caseItem.status === "matching" || caseItem.status === "offers_ready";
  const alreadyInvolved = isRelevantToTechnician(caseItem, technicianId);
  if (!(openStatus && !alreadyInvolved)) return false;
  if (!providerType) return true;
  return isCaseKindAvailableForProviderType(caseItem.kind, providerType);
}

// Canonical rule: towing → yalnızca cekici (tow-priority audit 2026-04-23
// P0-6 + invariant checklist "towing sadece cekici adaylarına görünür").
const CASE_KIND_PROVIDERS: Record<ServiceRequestKind, ProviderType[]> = {
  accident: ["usta", "kaporta_boya", "cekici"],
  towing: ["cekici"],
  breakdown: ["usta", "oto_elektrik", "lastik", "cekici"],
  maintenance: ["usta", "lastik", "oto_elektrik", "oto_aksesuar"],
};

export function isCaseKindAvailableForProviderType(
  kind: ServiceRequestKind,
  providerType: ProviderType,
): boolean {
  return CASE_KIND_PROVIDERS[kind]?.includes(providerType) ?? false;
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

// P1-4 launch migration (2026-04-23): `seedTrackingCases()` demo source
// disable — launch path canlı `useCasePoolLive` + consumer migration.
// Demo data sadece DEV ortamında test fixture olarak çağrılır (şu an
// import edilmiş ama kullanılmıyor; preview mode V1.1'de flag'lenir).
void seedTrackingCases;

export const useJobsStore = create<JobsState>((set) => ({
  technicianId: PRIMARY_TECHNICIAN_ID,
  cases: [],
  markSeen: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        markCaseSeen(caseItem, "technician"),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  addEvidence: (caseId, taskId, attachment, note) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        addTechnicianEvidenceToCase(caseItem, taskId, attachment, note),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  shareStatusUpdate: (caseId, note) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        shareTechnicianStatusUpdate(caseItem, note),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  requestPartsApproval: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, requestTechnicianPartsApproval);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  shareInvoice: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, shareTechnicianInvoice);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  markReadyForDelivery: (caseId, report) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        markCaseReadyForDelivery(caseItem, report),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  sendMessage: (caseId, body) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        sendCaseMessage(caseItem, "technician", body),
      );
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  submitOffer: (caseId, payload) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, (caseItem) =>
        submitOfferForCase(caseItem, payload),
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
  cancelAppointment: (caseId) => {
    let updatedCase: ServiceCase | null = null;

    set((state) => {
      const result = updateCaseById(state.cases, caseId, cancelAppointmentForCase);
      updatedCase = result.updatedCase;
      return { cases: result.cases };
    });

    return updatedCase;
  },
  createInsuranceCase: (payload) => {
    const newCase = createTechnicianInsuranceCase(payload);
    set((state) => ({ cases: [newCase, ...state.cases] }));
    return newCase;
  },
}));
