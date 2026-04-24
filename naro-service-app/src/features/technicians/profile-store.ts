import type {
  BrandCoverage,
  Drivetrain,
  MyTechnicianCertificate,
  MyTechnicianProfile,
  ProcedureBinding,
  ProviderMode,
  ProviderType,
  ServiceArea,
  ServiceDomain,
  StaffCapacity,
  TechnicianCapability,
  TechnicianCertificate,
  TechnicianCertificateStatus,
  WeeklySchedule,
} from "@naro/domain";
import { create } from "zustand";

import { INITIAL_TECHNICIAN_PROFILE } from "./data/fixtures";
import type { BusinessInfo, TechnicianProfileState } from "./types";

type TechnicianProfileStore = TechnicianProfileState & {
  setAvailability: (availability: TechnicianProfileState["availability"]) => void;
  toggleCapability: (key: keyof TechnicianCapability) => void;
  setCapability: (key: keyof TechnicianCapability, value: boolean) => void;
  updateBusiness: (patch: Partial<BusinessInfo>) => void;
  updateField: <K extends keyof TechnicianProfileState>(
    key: K,
    value: TechnicianProfileState[K],
  ) => void;
  addSpecialty: (label: string) => void;
  removeSpecialty: (label: string) => void;
  addExpertise: (label: string) => void;
  removeExpertise: (label: string) => void;
  addCertificate: (cert: TechnicianCertificate) => void;
  removeCertificate: (id: string) => void;
  updateCertificateStatus: (
    id: string,
    status: TechnicianCertificateStatus,
    reviewerNote?: string | null,
  ) => void;

  // V2 — coverage
  toggleServiceDomain: (domain: ServiceDomain) => void;
  setServiceDomains: (domains: ServiceDomain[]) => void;
  toggleProcedure: (key: string) => void;
  setProcedures: (procedures: ProcedureBinding[]) => void;
  addProcedureTag: (tag: string) => void;
  removeProcedureTag: (tag: string) => void;
  toggleBrand: (key: string) => void;
  setBrandAuthorization: (
    key: string,
    patch: Partial<Pick<BrandCoverage, "is_authorized" | "is_premium_authorized">>,
  ) => void;
  setBrandCoverage: (coverage: BrandCoverage[]) => void;
  toggleDrivetrain: (key: Drivetrain) => void;
  setDrivetrainCoverage: (drivetrains: Drivetrain[]) => void;

  // V2 — service area
  setServiceArea: (area: ServiceArea) => void;
  updateServiceArea: (patch: Partial<ServiceArea>) => void;

  // V2 — schedule
  setSchedule: (schedule: WeeklySchedule) => void;

  // V2 — capacity
  setCapacity: (capacity: StaffCapacity) => void;
  updateCapacity: (patch: Partial<StaffCapacity>) => void;

  // Shell rol/mode kontrolü
  setProviderMode: (mode: ProviderMode) => void;
  setActiveProviderType: (type: ProviderType) => void;
  bumpRoleConfigVersion: () => void;

  // Backend hydrate / reset
  hydrate: (
    profile: MyTechnicianProfile,
    certs: MyTechnicianCertificate[],
  ) => void;
  reset: () => void;
};

/**
 * Backend `MyTechnicianCertificate` (HTTP shape) → UI `TechnicianCertificate`
 * (fixture shape) adapter. UI render'ı `file_url` + `mime_type` bekliyor ama
 * BE cert'lerde bu alanlar yok (media_asset_id var); şimdilik boş string/undefined
 * ile doldururuz — UI cert listesinde gerçek file preview gerektiği anda
 * ayrı media asset fetch gerekir (post-pilot).
 */
function adaptCertificate(cert: MyTechnicianCertificate): TechnicianCertificate {
  return {
    id: cert.id,
    technician_id: cert.profile_id,
    kind: cert.kind,
    title: cert.title,
    file_url: "",
    mime_type: undefined,
    asset: null,
    uploaded_at: cert.uploaded_at,
    verified_at: cert.verified_at,
    expires_at: cert.expires_at,
    status: cert.status,
    reviewer_note: cert.reviewer_note,
  };
}

export const useTechnicianProfileStore = create<TechnicianProfileStore>(
  (set) => ({
    ...INITIAL_TECHNICIAN_PROFILE,
    setAvailability: (availability) => set({ availability }),
    toggleCapability: (key) =>
      set((state) => ({
        capabilities: { ...state.capabilities, [key]: !state.capabilities[key] },
      })),
    setCapability: (key, value) =>
      set((state) => ({
        capabilities: { ...state.capabilities, [key]: value },
      })),
    updateBusiness: (patch) =>
      set((state) => ({ business: { ...state.business, ...patch } })),
    updateField: (key, value) =>
      set({ [key]: value } as Partial<TechnicianProfileState>),
    addSpecialty: (label) =>
      set((state) => ({
        specialties: state.specialties.includes(label)
          ? state.specialties
          : [...state.specialties, label],
      })),
    removeSpecialty: (label) =>
      set((state) => ({
        specialties: state.specialties.filter((s) => s !== label),
      })),
    addExpertise: (label) =>
      set((state) => ({
        expertise: state.expertise.includes(label)
          ? state.expertise
          : [...state.expertise, label],
      })),
    removeExpertise: (label) =>
      set((state) => ({
        expertise: state.expertise.filter((e) => e !== label),
      })),
    addCertificate: (cert) =>
      set((state) => ({ certificates: [...state.certificates, cert] })),
    removeCertificate: (id) =>
      set((state) => ({
        certificates: state.certificates.filter((c) => c.id !== id),
      })),
    updateCertificateStatus: (id, status, reviewerNote) =>
      set((state) => ({
        certificates: state.certificates.map((c) =>
          c.id === id
            ? {
                ...c,
                status,
                reviewer_note: reviewerNote ?? c.reviewer_note,
                verified_at:
                  status === "approved" ? new Date().toISOString() : c.verified_at,
              }
            : c,
        ),
      })),

    // coverage
    toggleServiceDomain: (domain) =>
      set((state) => ({
        service_domains: state.service_domains.includes(domain)
          ? state.service_domains.filter((d) => d !== domain)
          : [...state.service_domains, domain],
      })),
    setServiceDomains: (domains) => set({ service_domains: domains }),
    toggleProcedure: (key) =>
      set((state) => {
        const exists = state.procedures.some((p) => p.key === key);
        return {
          procedures: exists
            ? state.procedures.filter((p) => p.key !== key)
            : [
                ...state.procedures,
                { key, confidence_self_declared: 1, confidence_verified: null },
              ],
        };
      }),
    setProcedures: (procedures) => set({ procedures }),
    addProcedureTag: (tag) =>
      set((state) => {
        const normalized = tag.trim();
        if (!normalized) return state;
        if (state.procedure_tags.includes(normalized)) return state;
        return { procedure_tags: [...state.procedure_tags, normalized] };
      }),
    removeProcedureTag: (tag) =>
      set((state) => ({
        procedure_tags: state.procedure_tags.filter((t) => t !== tag),
      })),
    toggleBrand: (key) =>
      set((state) => {
        const exists = state.brand_coverage.some((b) => b.key === key);
        return {
          brand_coverage: exists
            ? state.brand_coverage.filter((b) => b.key !== key)
            : [
                ...state.brand_coverage,
                { key, is_authorized: false, is_premium_authorized: false },
              ],
        };
      }),
    setBrandAuthorization: (key, patch) =>
      set((state) => ({
        brand_coverage: state.brand_coverage.map((b) =>
          b.key === key ? { ...b, ...patch } : b,
        ),
      })),
    setBrandCoverage: (coverage) => set({ brand_coverage: coverage }),
    toggleDrivetrain: (key) =>
      set((state) => ({
        drivetrain_coverage: state.drivetrain_coverage.includes(key)
          ? state.drivetrain_coverage.filter((d) => d !== key)
          : [...state.drivetrain_coverage, key],
      })),
    setDrivetrainCoverage: (drivetrains) =>
      set({ drivetrain_coverage: drivetrains }),

    // service area
    setServiceArea: (area) => set({ service_area: area }),
    updateServiceArea: (patch) =>
      set((state) => ({ service_area: { ...state.service_area, ...patch } })),

    // schedule
    setSchedule: (schedule) => set({ working_schedule: schedule }),

    // capacity
    setCapacity: (capacity) => set({ capacity }),
    updateCapacity: (patch) =>
      set((state) => ({ capacity: { ...state.capacity, ...patch } })),

    // shell rol/mode
    setProviderMode: (mode) =>
      set((state) => ({
        provider_mode: mode,
        role_config_version: state.role_config_version + 1,
      })),
    setActiveProviderType: (type) =>
      set((state) => ({
        active_provider_type: type,
        role_config_version: state.role_config_version + 1,
      })),
    bumpRoleConfigVersion: () =>
      set((state) => ({ role_config_version: state.role_config_version + 1 })),

    // Backend /technicians/me/profile + /me/certificates hydrate.
    // Fixture alanları (coverage, service_area, schedule, capacity, gallery)
    // ayrı endpoint scope'unda — bu hydrate'te dokunulmaz; login öncesi seed
    // olarak kalır. Post-pilot: ayrı PUT endpoint'leri için ek hook.
    hydrate: (profile, certs) =>
      set((state) => ({
        name: profile.display_name,
        tagline: profile.tagline ?? state.tagline,
        biography: profile.biography ?? state.biography,
        availability: profile.availability,
        verified_level: profile.verified_level,
        provider_type: profile.provider_type,
        secondary_provider_types: profile.secondary_provider_types,
        provider_mode: profile.provider_mode,
        active_provider_type: profile.active_provider_type,
        role_config_version: profile.role_config_version,
        capabilities: profile.capability ?? state.capabilities,
        business: {
          ...state.business,
          ...(profile.business_info as Partial<BusinessInfo>),
        },
        certificates: certs.map(adaptCertificate),
        hydrated: true,
      })),

    reset: () => set({ ...INITIAL_TECHNICIAN_PROFILE }),
  }),
);

export const useInsuranceCapability = () =>
  useTechnicianProfileStore((state) => state.capabilities.insurance_case_handler);

const APPROVED_TO_LEVEL: Record<number, "basic" | "verified" | "premium"> = {
  0: "basic",
  1: "basic",
  2: "basic",
  3: "verified",
  4: "verified",
  5: "premium",
  6: "premium",
};

export const useComputedVerifiedLevel = () =>
  useTechnicianProfileStore((state) => {
    const approvedCount = state.certificates.filter((c) => c.status === "approved").length;
    return APPROVED_TO_LEVEL[Math.min(approvedCount, 6)] ?? "basic";
  });
