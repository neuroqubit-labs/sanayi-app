import type { ProviderType, TechnicianCertificate } from "@naro/domain";

export type TowCapabilityState = {
  provider_qualifies: boolean;
  certificate_approved: boolean;
  has_pending_certificate: boolean;
  can_show_ui: boolean;
  can_activate: boolean;
};

function findTowCertificate(
  certificates: TechnicianCertificate[],
): TechnicianCertificate | null {
  return certificates.find((c) => c.kind === "tow_operator") ?? null;
}

export type TowCapabilityInput = {
  provider_type: ProviderType;
  secondary_provider_types: ProviderType[];
  certificates: TechnicianCertificate[];
};

export function resolveTowCapability(
  profile: TowCapabilityInput,
): TowCapabilityState {
  const provider_qualifies =
    profile.provider_type === "cekici" ||
    profile.secondary_provider_types.includes("cekici");

  const towCert = findTowCertificate(profile.certificates);
  const certificate_approved = towCert?.status === "approved";
  const has_pending_certificate = towCert?.status === "pending";

  const can_show_ui = provider_qualifies;
  const can_activate = provider_qualifies && certificate_approved;

  return {
    provider_qualifies,
    certificate_approved,
    has_pending_certificate,
    can_show_ui,
    can_activate,
  };
}
