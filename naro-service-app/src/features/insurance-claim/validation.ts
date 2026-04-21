import type { ClaimDraft } from "./types";

export type MissingField = {
  key: string;
  label: string;
};

export function getMissingFields(draft: ClaimDraft): MissingField[] {
  const missing: MissingField[] = [];
  if (draft.plate.trim().length < 5) {
    missing.push({ key: "plate", label: "Plaka" });
  }
  if (draft.customer_name.trim().length < 2) {
    missing.push({ key: "customer_name", label: "Müşteri adı" });
  }
  if (draft.damage_area.trim().length < 2) {
    missing.push({ key: "damage_area", label: "Hasar bölgesi" });
  }
  if (draft.summary.trim().length < 4) {
    missing.push({ key: "summary", label: "Olay özeti" });
  }
  if (draft.vehicle_drivable === null) {
    missing.push({ key: "vehicle_drivable", label: "Araç sürülebilir mi" });
  }
  if (!draft.report_method) {
    missing.push({ key: "report_method", label: "Tutanak yöntemi" });
  }
  if (!draft.accident_kind) {
    missing.push({ key: "accident_kind", label: "Kaza türü" });
  }
  if (
    draft.accident_kind === "multi" &&
    !draft.counterparty_vehicle_count
  ) {
    missing.push({
      key: "counterparty_vehicle_count",
      label: "Karşı araç sayısı",
    });
  }
  if (draft.insurer.trim().length < 2) {
    missing.push({ key: "insurer", label: "Sigorta şirketi" });
  }
  if (draft.policy_number.trim().length < 3) {
    missing.push({ key: "policy_number", label: "Poliçe numarası" });
  }
  return missing;
}

export function isSubmitReady(draft: ClaimDraft): boolean {
  return getMissingFields(draft).length === 0;
}
