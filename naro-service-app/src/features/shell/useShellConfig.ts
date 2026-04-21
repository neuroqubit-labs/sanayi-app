import type { ProviderType, ShellConfig } from "@naro/domain";
import { useMemo } from "react";

import { useTechnicianProfileStore } from "@/features/technicians";

import {
  V1_TAB_SET,
  resolveHomeLayout,
  resolveQuickActionSet,
  resolveRequiredCertKinds,
} from "./matrices";

function resolveEnabledCapabilities(
  capabilities: {
    insurance_case_handler: boolean;
    on_site_repair: boolean;
    valet_service: boolean;
    towing_coordination: boolean;
  },
  activeType: ProviderType,
  towOperatorCertApproved: boolean,
): string[] {
  const out: string[] = [];
  if (capabilities.insurance_case_handler) out.push("insurance_case_handler");
  if (capabilities.on_site_repair) out.push("on_site_repair");
  if (capabilities.valet_service) out.push("valet_service");
  if (capabilities.towing_coordination) out.push("towing_coordination");
  if (activeType === "cekici" && towOperatorCertApproved) out.push("tow");
  const campaignSupported =
    activeType === "usta" ||
    activeType === "kaporta_boya" ||
    activeType === "lastik" ||
    activeType === "oto_elektrik";
  if (campaignSupported) out.push("campaigns");
  return out;
}

function resolveRequiredOnboardingSteps(
  requiredCertKinds: string[],
  certStatusByKind: Map<string, string>,
): string[] {
  const steps: string[] = [];
  for (const kind of requiredCertKinds) {
    const status = certStatusByKind.get(kind);
    if (status !== "approved") {
      steps.push(`upload_cert:${kind}`);
    }
  }
  return steps;
}

export function useShellConfig(): ShellConfig {
  const provider_type = useTechnicianProfileStore((s) => s.provider_type);
  const secondary_provider_types = useTechnicianProfileStore(
    (s) => s.secondary_provider_types,
  );
  const active_provider_type = useTechnicianProfileStore(
    (s) => s.active_provider_type,
  );
  const provider_mode = useTechnicianProfileStore((s) => s.provider_mode);
  const role_config_version = useTechnicianProfileStore(
    (s) => s.role_config_version,
  );
  const verified_level = useTechnicianProfileStore((s) => s.verified_level);
  const capabilities = useTechnicianProfileStore((s) => s.capabilities);
  const certificates = useTechnicianProfileStore((s) => s.certificates);

  return useMemo<ShellConfig>(() => {
    const activeType: ProviderType = active_provider_type ?? provider_type;
    const home_layout = resolveHomeLayout(activeType, provider_mode);
    const required_cert_kinds = resolveRequiredCertKinds(
      activeType,
      provider_mode,
    );
    const quick_action_set = resolveQuickActionSet(home_layout);

    const certStatusByKind = new Map<string, string>();
    for (const cert of certificates) {
      const current = certStatusByKind.get(cert.kind);
      if (!current || cert.status === "approved") {
        certStatusByKind.set(cert.kind, cert.status);
      }
    }

    const towOperatorApproved =
      certStatusByKind.get("tow_operator") === "approved";

    const enabled_capabilities = resolveEnabledCapabilities(
      capabilities,
      activeType,
      towOperatorApproved,
    );

    const required_onboarding_steps = resolveRequiredOnboardingSteps(
      required_cert_kinds,
      certStatusByKind,
    );

    const admission_gate_passed = required_onboarding_steps.length === 0;
    const admission_status = admission_gate_passed ? "active" : "pending";

    return {
      primary_provider_type: provider_type,
      active_provider_type: activeType,
      provider_mode,
      secondary_provider_types,
      verified_level,
      admission_status,
      admission_gate_passed,
      enabled_capabilities,
      home_layout,
      tab_set: V1_TAB_SET,
      quick_action_set,
      required_onboarding_steps,
      required_cert_kinds,
      role_config_version,
    };
  }, [
    active_provider_type,
    capabilities,
    certificates,
    provider_mode,
    provider_type,
    role_config_version,
    secondary_provider_types,
    verified_level,
  ]);
}
