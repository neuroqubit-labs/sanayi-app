import type { ServiceRequestKind } from "@naro/domain";

import type { CaseSummaryResponse } from "@/features/cases/schemas/case-create";

import type { ProviderType } from "./schemas";

const ACTIVE_STATUSES = new Set([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
]);

/**
 * Vaka kind'ı ile teknisyen provider_type'ının temel uyumluluğu.
 * - towing: sadece cekici provider'lar
 * - accident/breakdown/maintenance: cekici olmayan provider'lar
 *
 * V1 konservatif kural; V1.1'de provider capability + brand coverage
 * matrix devreye girecek.
 */
export function technicianMatchesCaseKind(
  kind: ServiceRequestKind,
  providerType: ProviderType,
): boolean {
  if (kind === "towing") return providerType === "cekici";
  return providerType !== "cekici";
}

export type TechnicianCtaMode =
  | "ready" // aktif + uyumlu vaka var → vakayı bildir / teklif bekle
  | "mismatch" // aktif vaka var ama usta uygun değil
  | "no_case"; // aktif vaka yok → önce vaka aç

export type TechnicianCta = {
  mode: TechnicianCtaMode;
  caseId: string | null;
  primaryLabel: string;
  primaryRoute: string;
  primaryDisabled: boolean;
  helperText?: string;
};

/**
 * Çarşı/preview'da gösterilecek CTA'yı belirle.
 * Aktif vaka ve usta tipine göre mode derive eder.
 */
export function resolveTechnicianCta(opts: {
  technicianId: string;
  providerType: ProviderType;
  activeCases: CaseSummaryResponse[];
  acceptingNewJobs: boolean;
  activeCaseMatchesTechnician?: boolean | null;
  activeCaseMatchReason?: string | null;
}): TechnicianCta {
  const {
    technicianId,
    providerType,
    activeCases,
    acceptingNewJobs,
    activeCaseMatchesTechnician,
    activeCaseMatchReason,
  } = opts;

  if (!acceptingNewJobs) {
    return {
      mode: "no_case",
      caseId: null,
      primaryLabel: "Servis yeni iş almıyor",
      primaryRoute: "",
      primaryDisabled: true,
      helperText: "Bu servis şu an kapasitesi dolu.",
    };
  }

  const activeCase =
    activeCases
      .filter((c) => ACTIVE_STATUSES.has(c.status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;

  if (!activeCase) {
    return {
      mode: "no_case",
      caseId: null,
      primaryLabel: "Önce vaka aç",
      primaryRoute: `/(modal)/quick-actions`,
      primaryDisabled: false,
      helperText: "Randevu için önce bakım, arıza veya hasar vakası açmalısın.",
    };
  }

  const matches =
    activeCaseMatchesTechnician ?? technicianMatchesCaseKind(activeCase.kind, providerType);
  if (!matches) {
    return {
      mode: "mismatch",
      caseId: activeCase.id,
      primaryLabel: "Uygun vaka oluştur",
      primaryRoute: `/(modal)/usta-vaka/${technicianId}`,
      primaryDisabled: false,
      helperText:
        activeCase.kind === "towing"
          ? "Çekici vakası ayrı çağrı akışıyla ilerler."
          : "Mevcut aktif vakan bu ustanın uzmanlığıyla eşleşmiyor.",
    };
  }

  return {
    mode: "ready",
    caseId: activeCase.id,
    primaryLabel: "Vakayı bildir",
    primaryRoute: `/vaka/${activeCase.id}`,
    primaryDisabled: false,
    helperText:
      activeCaseMatchReason ??
      "Usta teklif gönderirse randevu ve ödeme adımına geçersin.",
  };
}
