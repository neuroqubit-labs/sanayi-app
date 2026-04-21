import type { CaseAttachment } from "@naro/domain";

export type CoverageKind = "kasko" | "trafik";
export type ReportMethod = "e_devlet" | "paper" | "police";
export type AccidentKind = "single" | "multi";

export type ClaimDraft = {
  // Kaynak vaka (prefill kaydı)
  source_case_id: string | null;

  // Müşteri & araç
  plate: string;
  vehicle_label: string;
  customer_name: string;
  customer_phone: string;

  // Hasar tespiti
  damage_area: string;
  summary: string;
  vehicle_drivable: boolean | null;
  evidence: CaseAttachment[];

  // Tutanak & lokasyon
  report_method: ReportMethod | null;
  accident_kind: AccidentKind | null;
  counterparty_vehicle_count: number | null;
  counterparty_note: string;
  location_label: string;

  // Sigorta
  coverage_kind: CoverageKind;
  insurer: string;
  policy_number: string;
  estimate: string;
  notes: string;

  // Vakadan gelen silent alanlar (UI'da sorulmaz, backend'e pass-through)
  ambulance_contacted: boolean;
  towing_required: boolean;
};

export function emptyClaimDraft(): ClaimDraft {
  return {
    source_case_id: null,
    plate: "",
    vehicle_label: "",
    customer_name: "",
    customer_phone: "",
    damage_area: "",
    summary: "",
    vehicle_drivable: null,
    evidence: [],
    report_method: null,
    accident_kind: null,
    counterparty_vehicle_count: null,
    counterparty_note: "",
    location_label: "",
    coverage_kind: "kasko",
    insurer: "",
    policy_number: "",
    estimate: "",
    notes: "",
    ambulance_contacted: false,
    towing_required: false,
  };
}
