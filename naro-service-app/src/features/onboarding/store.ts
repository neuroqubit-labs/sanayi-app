import type {
  BrandCoverage,
  Drivetrain,
  ProcedureBinding,
  ProviderMode,
  ProviderType,
  ServiceArea,
  ServiceDomain,
  StaffCapacity,
  TechnicianCapability,
  TechnicianCertificate,
  WeeklySchedule,
} from "@naro/domain";
import {
  DEFAULT_CAPACITY,
  EMPTY_SCHEDULE,
  EMPTY_SERVICE_AREA,
} from "@naro/domain";
import { create } from "zustand";

import type { BusinessInfo } from "@/features/technicians";

type OnboardingBusiness = Partial<BusinessInfo> & {
  tagline?: string;
};

type OnboardingState = {
  step: number;
  provider_type: ProviderType | null;
  provider_mode: ProviderMode | null;
  business: OnboardingBusiness;
  capabilities: Partial<TechnicianCapability>;
  certificates: TechnicianCertificate[];

  // V2 coverage
  service_domains: ServiceDomain[];
  procedures: ProcedureBinding[];
  procedure_tags: string[];
  brand_coverage: BrandCoverage[];
  drivetrain_coverage: Drivetrain[];

  // V2 service area
  service_area: ServiceArea;

  // V2 schedule
  working_schedule: WeeklySchedule;

  // V2 capacity
  capacity: StaffCapacity;

  setProviderType: (type: ProviderType) => void;
  setProviderMode: (mode: ProviderMode) => void;
  updateBusiness: (patch: OnboardingBusiness) => void;
  toggleCapability: (key: keyof TechnicianCapability) => void;
  addCertificate: (cert: TechnicianCertificate) => void;
  removeCertificate: (id: string) => void;

  toggleServiceDomain: (domain: ServiceDomain) => void;
  setServiceDomains: (domains: ServiceDomain[]) => void;
  toggleProcedure: (key: string) => void;
  addProcedureTag: (tag: string) => void;
  removeProcedureTag: (tag: string) => void;
  toggleBrand: (key: string) => void;
  setBrandAuthorization: (
    key: string,
    patch: Partial<Pick<BrandCoverage, "is_authorized" | "is_premium_authorized">>,
  ) => void;
  toggleDrivetrain: (key: Drivetrain) => void;

  updateServiceArea: (patch: Partial<ServiceArea>) => void;
  setWorkingSchedule: (schedule: WeeklySchedule) => void;
  updateCapacity: (patch: Partial<StaffCapacity>) => void;

  setStep: (step: number) => void;
  reset: () => void;
};

const INITIAL: Pick<
  OnboardingState,
  | "step"
  | "provider_type"
  | "provider_mode"
  | "business"
  | "capabilities"
  | "certificates"
  | "service_domains"
  | "procedures"
  | "procedure_tags"
  | "brand_coverage"
  | "drivetrain_coverage"
  | "service_area"
  | "working_schedule"
  | "capacity"
> = {
  step: 0,
  provider_type: null,
  provider_mode: null,
  business: {},
  capabilities: {},
  certificates: [],
  service_domains: [],
  procedures: [],
  procedure_tags: [],
  brand_coverage: [],
  drivetrain_coverage: [],
  service_area: { ...EMPTY_SERVICE_AREA },
  working_schedule: { ...EMPTY_SCHEDULE, slots: [] },
  capacity: { ...DEFAULT_CAPACITY },
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...INITIAL,

  setProviderType: (type) => set({ provider_type: type }),
  setProviderMode: (mode) => set({ provider_mode: mode }),
  updateBusiness: (patch) =>
    set((state) => ({ business: { ...state.business, ...patch } })),
  toggleCapability: (key) =>
    set((state) => ({
      capabilities: { ...state.capabilities, [key]: !state.capabilities[key] },
    })),
  addCertificate: (cert) =>
    set((state) => ({ certificates: [...state.certificates, cert] })),
  removeCertificate: (id) =>
    set((state) => ({
      certificates: state.certificates.filter((c) => c.id !== id),
    })),

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
  toggleDrivetrain: (key) =>
    set((state) => ({
      drivetrain_coverage: state.drivetrain_coverage.includes(key)
        ? state.drivetrain_coverage.filter((d) => d !== key)
        : [...state.drivetrain_coverage, key],
    })),

  updateServiceArea: (patch) =>
    set((state) => ({ service_area: { ...state.service_area, ...patch } })),
  setWorkingSchedule: (schedule) => set({ working_schedule: schedule }),
  updateCapacity: (patch) =>
    set((state) => ({ capacity: { ...state.capacity, ...patch } })),

  setStep: (step) => set({ step }),
  reset: () =>
    set({
      ...INITIAL,
      service_area: { ...EMPTY_SERVICE_AREA },
      working_schedule: { ...EMPTY_SCHEDULE, slots: [] },
      capacity: { ...DEFAULT_CAPACITY },
    }),
}));
