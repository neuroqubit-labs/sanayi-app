import type {
  CaseAttachment,
  MaintenanceCategory,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";

import { MAINTENANCE_TEMPLATES } from "./composer/data/maintenanceTemplates";

export type CaseCreationAttachmentRequirement = {
  category: string;
  label: string;
  required: boolean;
};

export type CaseCreationContract = {
  kind: ServiceRequestKind;
  intent: string;
  requiredSignals: string[];
  optionalSignals: string[];
  backendRequiredFields: string[];
  submitRoute: "/cases";
  successTarget: "case_detail" | "tow_tracking";
  getAttachmentRequirements: (
    draft: ServiceRequestDraft,
  ) => CaseCreationAttachmentRequirement[];
};

function maintenanceAttachmentRequirements(
  category: MaintenanceCategory | null | undefined,
): CaseCreationAttachmentRequirement[] {
  if (!category) return [];
  return MAINTENANCE_TEMPLATES[category].evidence.map((step) => ({
    category: step.id,
    label: step.title,
    required: Boolean(step.required),
  }));
}

export const CASE_CREATION_CONTRACTS: Record<
  ServiceRequestKind,
  CaseCreationContract
> = {
  maintenance: {
    kind: "maintenance",
    intent: "Aracı sorunsuz devam ettirmek veya planlı özel talebi açmak.",
    requiredSignals: ["vehicle_id", "maintenance_category", "location_label"],
    optionalSignals: [
      "maintenance_items",
      "mileage_km",
      "attachments",
      "preferred_window",
      "pickup_preference",
      "price_preference",
      "towing_decision_made",
    ],
    backendRequiredFields: ["kind", "vehicle_id", "summary", "maintenance_category"],
    submitRoute: "/cases",
    successTarget: "case_detail",
    getAttachmentRequirements: (draft) =>
      maintenanceAttachmentRequirements(draft.maintenance_category),
  },
  breakdown: {
    kind: "breakdown",
    intent: "Arıza semptomunu ve aracın hareket kabiliyetini servise anlatmak.",
    requiredSignals: ["vehicle_id", "breakdown_category", "symptoms"],
    optionalSignals: [
      "vehicle_drivable",
      "on_site_repair",
      "towing_required",
      "towing_decision_made",
      "attachments",
      "price_preference",
    ],
    backendRequiredFields: ["kind", "vehicle_id", "summary", "breakdown_category", "symptoms"],
    submitRoute: "/cases",
    successTarget: "case_detail",
    getAttachmentRequirements: () => [],
  },
  accident: {
    kind: "accident",
    intent: "Hasarı güvenlik, olay ve kanıt sırasıyla kayıt altına almak.",
    requiredSignals: [
      "vehicle_id",
      "damage_area",
      "damage_severity",
      "report_method",
      "emergency_acknowledged",
    ],
    optionalSignals: [
      "counterparty_vehicle_count",
      "counterparty_note",
      "insurance",
      "attachments",
    ],
    backendRequiredFields: [
      "kind",
      "vehicle_id",
      "summary",
      "damage_area",
      "damage_severity",
      "report_method",
      "emergency_acknowledged",
    ],
    submitRoute: "/cases",
    successTarget: "case_detail",
    getAttachmentRequirements: () => [
      { category: "scene_overview", label: "Olay yeri genel fotoğrafı", required: true },
      { category: "damage_detail", label: "Hasar yakın çekimi", required: true },
    ],
  },
  towing: {
    kind: "towing",
    intent: "Aracı bulunduğu yerden servis veya teslim noktasına taşımak.",
    requiredSignals: [
      "vehicle_id",
      "location_label",
      "dropoff_label",
      "vehicle_drivable",
      "tow_mode",
      "tow_incident_reason",
    ],
    optionalSignals: [
      "tow_required_equipment",
      "tow_fare_quote",
      "tow_parent_case_id",
      "tow_scheduled_at",
    ],
    backendRequiredFields: [
      "kind",
      "vehicle_id",
      "summary",
      "location_label",
      "dropoff_label",
      "vehicle_drivable",
      "tow_mode",
      "tow_incident_reason",
    ],
    submitRoute: "/cases",
    successTarget: "tow_tracking",
    getAttachmentRequirements: () => [],
  },
};

export function getCaseCreationContract(kind: ServiceRequestKind) {
  return CASE_CREATION_CONTRACTS[kind];
}

export function getMissingRequiredAttachmentCategories(
  kind: ServiceRequestKind,
  draft: ServiceRequestDraft,
): CaseCreationAttachmentRequirement[] {
  const requirements = getCaseCreationContract(kind)
    .getAttachmentRequirements(draft)
    .filter((requirement) => requirement.required);
  if (requirements.length === 0) return [];

  const present = new Set(
    draft.attachments
      .map(resolveAttachmentCategory)
      .filter((category): category is string => Boolean(category)),
  );
  return requirements.filter((requirement) => !present.has(requirement.category));
}

export function resolveAttachmentCategory(
  attachment: CaseAttachment,
): string | null {
  if (attachment.category) return attachment.category;
  const [namespaced] = attachment.id.split(":");
  return namespaced || null;
}
