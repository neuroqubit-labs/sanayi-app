import type { ServiceCase } from "@naro/domain";
import { buildTechnicianTrackingView } from "@naro/mobile-core";

export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .trim();
}

export function buildSearchHaystack(caseItem: ServiceCase): string {
  const view = buildTechnicianTrackingView(caseItem);
  const myOffer = caseItem.offers.find(
    (o) => o.technician_id === caseItem.assigned_technician_id,
  );
  const plate = view.vehicle?.plate ?? "";
  const plateCompact = plate.replace(/\s+/g, "");
  const parts = [
    caseItem.id,
    caseItem.title,
    caseItem.subtitle,
    caseItem.summary,
    caseItem.kind,
    view.customerName,
    view.header.summaryTitle,
    view.header.statusLabel,
    view.header.waitLabel,
    plate,
    plateCompact,
    view.vehicle?.vehicleLabel ?? "",
    caseItem.request.breakdown_category ?? "",
    caseItem.request.damage_area ?? "",
    caseItem.request.maintenance_category ?? "",
    caseItem.request.summary ?? "",
    caseItem.request.location_label ?? "",
    myOffer?.headline ?? "",
    myOffer?.description ?? "",
    caseItem.insurance_claim?.insurer ?? "",
    caseItem.insurance_claim?.policy_number ?? "",
    caseItem.insurance_claim?.customer_name ?? "",
    caseItem.insurance_claim?.coverage_kind ?? "",
  ];
  return normalizeForSearch(parts.filter(Boolean).join(" | "));
}

export function matchesQuery(caseItem: ServiceCase, needle: string): boolean {
  if (!needle) return true;
  const blob = buildSearchHaystack(caseItem);
  const tokens = normalizeForSearch(needle).split(" ").filter(Boolean);
  return tokens.every((token) => blob.includes(token));
}
