import type {
  CaseActionType,
  CaseApproval,
  CaseOffer,
  ServiceCase,
  ServiceCaseStatus,
  ServiceRequestKind,
} from "@naro/domain";
import {
  getPrimaryTask,
  getTaskDeeplinkIntent,
  getTrackingProgressValue,
  getTrackingStatusLabel,
  getTrackingStatusTone,
} from "@naro/mobile-core";

export const ACTIVE_CASE_STATUSES: ServiceCaseStatus[] = [
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
];

export type CaseActionDescriptor = {
  type: CaseActionType;
  label: string;
  route?: string;
};

export function isActiveServiceCase(caseItem: ServiceCase) {
  return ACTIVE_CASE_STATUSES.includes(caseItem.status);
}

export function getCaseKindLabel(kind: ServiceRequestKind) {
  switch (kind) {
    case "accident":
      return "Kaza";
    case "towing":
      return "Cekici";
    case "breakdown":
      return "Ariza";
    case "maintenance":
      return "Bakim";
  }
}

export function getCaseStatusTone(status: ServiceCaseStatus) {
  return getTrackingStatusTone(status);
}

export function getCaseStatusLabel(status: ServiceCaseStatus) {
  return getTrackingStatusLabel(status);
}

export function getCaseProgressValue(status: ServiceCaseStatus) {
  return getTrackingProgressValue(status);
}

export function getCaseRoute(caseId: string) {
  return `/vaka/${caseId}`;
}

export function getCaseTrackingRoute(caseId: string) {
  return `/vaka/${caseId}/surec`;
}

export function getCaseTaskRoute(caseId: string, taskId: string) {
  return `/vaka/${caseId}/gorev/${taskId}`;
}

export function getCaseMessagesRoute(caseId: string) {
  return `/vaka/${caseId}/mesajlar`;
}

export function getCaseOffersRoute(caseId: string) {
  return `/vaka/${caseId}/teklifler`;
}

export function getCaseDocumentsRoute(caseId: string) {
  return `/vaka/${caseId}/belgeler`;
}

export function getCaseApprovalRoute(caseId: string, approvalId: string) {
  return `/vaka/${caseId}/onay/${approvalId}`;
}

export function getCaseActionLabel(
  action: CaseActionType,
  caseItem: ServiceCase,
): string {
  switch (action) {
    case "refresh_matching":
      return "Durumu yenile";
    case "change_service_preference":
      return "Ustalari ac";
    case "open_offers":
      return "Teklifleri ac";
    case "message_service":
      return "Servise yaz";
    case "request_appointment":
      return "Randevu Al";
    case "cancel_appointment":
      return "Randevuyu iptal et";
    case "cancel_case":
      return "Vakayı iptal et";
    case "confirm_appointment":
      return "Randevuyu onayla";
    case "approve_parts":
      return "Parca onayini ver";
    case "approve_invoice":
      return "Faturayi onayla";
    case "confirm_completion":
      return "Teslimi onayla";
    case "open_documents":
      return "Belgeleri ac";
    case "start_similar_request":
      return `${getCaseKindLabel(caseItem.kind)} talebi baslat`;
  }
}

export function isCaseActionAllowed(
  caseItem: ServiceCase,
  action: CaseActionType,
) {
  return caseItem.allowed_actions.includes(action);
}

function getApprovalActionRoute(
  caseItem: ServiceCase,
  kind: CaseApproval["kind"],
) {
  const approval = caseItem.pending_approvals.find(
    (item) => item.kind === kind && item.status === "pending",
  );

  return approval ? getCaseApprovalRoute(caseItem.id, approval.id) : undefined;
}

export function getCaseActionDescriptor(
  caseItem: ServiceCase,
  action: CaseActionType,
): CaseActionDescriptor | null {
  if (!isCaseActionAllowed(caseItem, action)) {
    return null;
  }

  const base = {
    type: action,
    label: getCaseActionLabel(action, caseItem),
  };

  switch (action) {
    case "refresh_matching":
      return base;
    case "change_service_preference":
      return { ...base, route: "/(tabs)/carsi" };
    case "open_offers":
      return { ...base, route: getCaseOffersRoute(caseItem.id) };
    case "message_service":
      return { ...base, route: getCaseMessagesRoute(caseItem.id) };
    case "request_appointment":
      return base;
    case "cancel_appointment":
      return base;
    case "cancel_case":
      return base;
    case "confirm_appointment":
      return base;
    case "approve_parts":
      return {
        ...base,
        route: getApprovalActionRoute(caseItem, "parts_request"),
      };
    case "approve_invoice":
      return {
        ...base,
        route: getApprovalActionRoute(caseItem, "invoice"),
      };
    case "confirm_completion":
      return {
        ...base,
        route: getApprovalActionRoute(caseItem, "completion"),
      };
    case "open_documents":
      return { ...base, route: getCaseDocumentsRoute(caseItem.id) };
    case "start_similar_request":
      return { ...base, route: `/(modal)/talep/${caseItem.kind}` };
  }
}

export function getCasePrimaryAction(caseItem: ServiceCase) {
  const task = getPrimaryTask(caseItem, "customer");

  if (task) {
    const intent = getTaskDeeplinkIntent(caseItem, task, "customer");
    return {
      type: "open_documents" as CaseActionType,
      label: intent.label,
      route: intent.route,
    };
  }

  const fallback: Record<ServiceCaseStatus, CaseActionType> = {
    matching: "refresh_matching",
    offers_ready: "open_offers",
    appointment_pending: "cancel_appointment",
    scheduled: "confirm_appointment",
    service_in_progress: "open_documents",
    parts_approval: "approve_parts",
    invoice_approval: "approve_invoice",
    completed: "open_documents",
    archived: "open_documents",
    cancelled: "start_similar_request",
  };

  return getCaseActionDescriptor(caseItem, fallback[caseItem.status]);
}

export function getCaseSecondaryAction(caseItem: ServiceCase) {
  const candidates: Record<ServiceCaseStatus, CaseActionType | null> = {
    matching: "change_service_preference",
    offers_ready: caseItem.assigned_service ? "message_service" : null,
    appointment_pending: "message_service",
    scheduled: "message_service",
    service_in_progress: "message_service",
    parts_approval: "message_service",
    invoice_approval: "message_service",
    completed: "start_similar_request",
    archived: "start_similar_request",
    cancelled: null,
  };

  const action = candidates[caseItem.status];
  return action ? getCaseActionDescriptor(caseItem, action) : null;
}

export function getCasePreviewOffers(caseItem: ServiceCase): CaseOffer[] {
  const ranked = [...caseItem.offers].sort((left, right) => {
    const statusRank: Record<CaseOffer["status"], number> = {
      accepted: 0,
      shortlisted: 1,
      pending: 2,
      rejected: 3,
      expired: 4,
    };

    return statusRank[left.status] - statusRank[right.status];
  });

  return ranked.slice(0, 2);
}

export function getCasePreviewDocuments(caseItem: ServiceCase) {
  return caseItem.documents.slice(0, 3);
}

export function getCasePreviewApprovals(caseItem: ServiceCase) {
  return caseItem.pending_approvals.slice(0, 2);
}

export function getCaseLastMessages(caseItem: ServiceCase) {
  return caseItem.thread.messages.slice(-2);
}

export function getCaseStickyMeta(caseItem: ServiceCase) {
  const primary = getCasePrimaryAction(caseItem);
  const secondary = getCaseSecondaryAction(caseItem);

  return {
    title: caseItem.next_action_title,
    description: caseItem.next_action_description,
    primary,
    secondary,
  };
}

export function getCaseActionSummary(caseItem: ServiceCase) {
  return {
    title: caseItem.next_action_title,
    description: caseItem.next_action_description,
    badgeTone: getCaseStatusTone(caseItem.status),
    badgeLabel: getCaseStatusLabel(caseItem.status),
  };
}
