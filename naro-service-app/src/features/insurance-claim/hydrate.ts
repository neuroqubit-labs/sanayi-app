import type { ServiceCase } from "@naro/domain";
import { getTrackingVehicleMeta } from "@naro/mobile-core";

import type { AccidentKind, ClaimDraft } from "./types";

export function prefillFromCase(caseItem: ServiceCase): Partial<ClaimDraft> {
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const d = caseItem.request;

  const accidentKind: AccidentKind | null =
    d.counterparty_vehicle_count && d.counterparty_vehicle_count > 0
      ? "multi"
      : d.counterparty_note
        ? "multi"
        : caseItem.kind === "accident"
          ? "single"
          : null;

  const coverageKind = d.kasko_selected
    ? ("kasko" as const)
    : d.sigorta_selected
      ? ("trafik" as const)
      : ("kasko" as const);

  const insurer =
    d.kasko_brand ??
    d.sigorta_brand ??
    caseItem.insurance_claim?.insurer ??
    "";

  return {
    source_case_id: caseItem.id,
    plate: vehicle?.plate ?? "",
    vehicle_label: vehicle?.vehicleLabel ?? caseItem.subtitle ?? "",
    customer_name:
      caseItem.insurance_claim?.customer_name ?? vehicle?.customerName ?? "",
    customer_phone: caseItem.insurance_claim?.customer_phone ?? "",
    damage_area: d.damage_area ?? "",
    summary: caseItem.summary ?? d.summary ?? "",
    vehicle_drivable: d.vehicle_drivable,
    evidence: caseItem.attachments.filter((a) => a.kind === "photo"),
    report_method: d.report_method,
    accident_kind: accidentKind,
    counterparty_vehicle_count: d.counterparty_vehicle_count ?? null,
    counterparty_note: d.counterparty_note ?? "",
    location_label: d.location_label ?? "",
    coverage_kind: coverageKind,
    insurer,
    policy_number: caseItem.insurance_claim?.policy_number ?? "",
    estimate:
      caseItem.insurance_claim?.claim_amount_estimate !== null &&
      caseItem.insurance_claim?.claim_amount_estimate !== undefined
        ? String(caseItem.insurance_claim.claim_amount_estimate)
        : "",
    notes: d.notes ?? "",
    ambulance_contacted: d.ambulance_contacted ?? false,
    towing_required: d.towing_required ?? false,
  };
}
