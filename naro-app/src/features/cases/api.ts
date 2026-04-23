import type {
  CaseAttachment,
  ServiceCase,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import { buildCustomerTrackingView } from "@naro/mobile-core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useTechnicianPublicView } from "@/features/ustalar/api";
import { useActiveVehicle } from "@/features/vehicles";
import type { Vehicle } from "@/features/vehicles/types";
import { apiClient } from "@/runtime";
import { mockDelay } from "@/shared/lib/mock";
import { queryClient } from "@/shared/lib/query";

import { useTechnicianCooldownStore } from "./cooldown-store";
import { createDraftForKind } from "./data/fixtures";
import {
  CaseCreateResponseSchema,
  CaseSummaryResponseSchema,
  ServiceRequestDraftCreateSchema,
  type CaseCreateResponse,
  type ServiceRequestDraftCreate,
} from "./schemas/case-create";
import { useCasesStore } from "./store";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";

function sortCases(cases: ServiceCase[]) {
  return [...cases].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

function isActiveCase(caseItem: ServiceCase) {
  return !["completed", "archived", "cancelled"].includes(caseItem.status);
}

async function invalidateCaseConsumers() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
    queryClient.invalidateQueries({ queryKey: ["home"] }),
    queryClient.invalidateQueries({ queryKey: ["records"] }),
    queryClient.invalidateQueries({ queryKey: ["technicians"] }),
  ]);
}

export function getSuggestedRequestKindForVehicle(vehicle: Vehicle | null) {
  if (!vehicle) {
    return "breakdown" as ServiceRequestKind;
  }

  if (vehicle.note?.toLowerCase().includes("bakim")) {
    return "maintenance" as ServiceRequestKind;
  }

  return "breakdown" as ServiceRequestKind;
}

export function prefillDraftForTechnician(
  kind: ServiceRequestKind,
  technicianId: string,
  vehicleId: string,
) {
  useCasesStore
    .getState()
    .prefillDraftTechnician(kind, vehicleId, technicianId);
  void invalidateCaseConsumers();
}

export function attachTechnicianToCase(caseId: string, technicianId: string) {
  useCasesStore.getState().attachTechnician(caseId, technicianId);
  void invalidateCaseConsumers();
}

export function useCasesFeed() {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useQuery<ServiceCase[]>({
    queryKey: ["cases", "feed", vehicleId],
    queryFn: () => {
      const cases = useCasesStore
        .getState()
        .cases.filter((caseItem) => caseItem.vehicle_id === vehicleId);

      return mockDelay(sortCases(cases));
    },
  });
}

export function useActiveCase() {
  const { data } = useCasesFeed();

  return {
    data: data?.find(isActiveCase) ?? null,
  };
}

export function useCaseDetail(caseId: string) {
  return useQuery<ServiceCase | null>({
    queryKey: ["cases", "detail", caseId],
    queryFn: () =>
      mockDelay(
        useCasesStore
          .getState()
          .cases.find((caseItem) => caseItem.id === caseId) ?? null,
      ),
  });
}

export function useCustomerTrackingView(caseId: string) {
  return useQuery({
    queryKey: ["cases", "tracking-view", caseId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(caseItem ? buildCustomerTrackingView(caseItem) : null);
    },
  });
}

export function useCaseTask(caseId: string, taskId: string) {
  return useQuery({
    queryKey: ["cases", "task", caseId, taskId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(
        caseItem?.tasks.find((task) => task.id === taskId) ?? null,
      );
    },
  });
}

export function useCaseThread(caseId: string) {
  return useQuery({
    queryKey: ["cases", "thread", caseId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(caseItem?.thread ?? null);
    },
  });
}

export function useCreateCaseDraft(kind: ServiceRequestKind) {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  const query = useQuery<ServiceRequestDraft>({
    queryKey: ["cases", "draft", kind, vehicleId],
    queryFn: async () => {
      const draft = useCasesStore.getState().getDraft(kind, vehicleId);
      return mockDelay(draft);
    },
    initialData: createDraftForKind(kind, vehicleId),
  });

  return {
    ...query,
    updateDraft: (patch: Partial<ServiceRequestDraft>) => {
      const draft = useCasesStore.getState().updateDraft(kind, patch);
      void queryClient.invalidateQueries({
        queryKey: ["cases", "draft", kind, vehicleId],
      });
      return draft;
    },
    resetDraft: () => {
      const draft = useCasesStore.getState().resetDraft(kind, vehicleId);
      void queryClient.invalidateQueries({
        queryKey: ["cases", "draft", kind, vehicleId],
      });
      return draft;
    },
  };
}

function deriveSummary(draft: ServiceRequestDraft, kind: ServiceRequestKind): string {
  const base = draft.notes?.trim();
  if (base && base.length >= 1) return base;
  const kindLabel: Record<ServiceRequestKind, string> = {
    accident: "Kaza / hasar bildirimi",
    breakdown: "Arıza bildirimi",
    maintenance: "Bakım talebi",
    towing: "Çekici talebi",
  };
  return kindLabel[kind];
}

function draftToCreatePayload(
  draft: ServiceRequestDraft,
  kind: ServiceRequestKind,
  vehicleId: string,
): ServiceRequestDraftCreate {
  const attachments = draft.attachments.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle ?? null,
    statusLabel: item.statusLabel ?? null,
    asset_id: item.asset?.id ?? null,
    category: null,
  }));

  return ServiceRequestDraftCreateSchema.parse({
    schema_version: "v1",
    kind,
    vehicle_id: vehicleId,
    urgency: draft.urgency ?? "planned",
    summary: deriveSummary(draft, kind),
    location_label: draft.location_label?.trim() || "Konum belirtilmedi",
    location_lat_lng: null,
    dropoff_label: draft.dropoff_label ?? null,
    dropoff_lat_lng: null,
    notes: draft.notes ?? null,
    attachments,
    symptoms: draft.symptoms ?? [],
    maintenance_items: draft.maintenance_items ?? [],
    preferred_window: draft.preferred_window ?? null,
    vehicle_drivable: draft.vehicle_drivable ?? null,
    towing_required: draft.towing_required ?? false,
    pickup_preference: draft.pickup_preference ?? null,
    mileage_km: draft.mileage_km ?? null,
    preferred_technician_id: draft.preferred_technician_id ?? null,
    counterparty_note: draft.counterparty_note ?? null,
    counterparty_vehicle_count: draft.counterparty_vehicle_count ?? null,
    damage_area: draft.damage_area ?? null,
    damage_severity: null,
    valet_requested: draft.valet_requested ?? false,
    report_method: draft.report_method ?? null,
    kasko_selected: draft.kasko_selected ?? false,
    kasko_brand: draft.kasko_brand ?? null,
    sigorta_selected: draft.sigorta_selected ?? false,
    sigorta_brand: draft.sigorta_brand ?? null,
    ambulance_contacted: draft.ambulance_contacted ?? false,
    emergency_acknowledged: draft.emergency_acknowledged ?? false,
    breakdown_category: draft.breakdown_category ?? null,
    on_site_repair: draft.on_site_repair ?? false,
    price_preference: draft.price_preference ?? null,
    maintenance_category: draft.maintenance_category ?? null,
    maintenance_detail: null,
    maintenance_tier: draft.maintenance_tier ?? null,
  });
}

export function useSubmitCase(kind: ServiceRequestKind) {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useMutation<ServiceCase, Error, void>({
    mutationFn: async () => {
      const storeState = useCasesStore.getState();
      const draft =
        storeState.drafts[kind] ??
        (() => {
          throw new Error("Draft eksik — composer'ı sıfırdan başlat.");
        })();

      // Evidence-first invariant (I-6) — attachment ownership + kind-bazlı
      // zorunlu alan kontrolü backend yanında tekrar enforce. FE burada
      // Zod parse ile temel şekli garanti eder; 422 detayı backend'den gelir.
      const payload = draftToCreatePayload(draft, kind, vehicleId);

      let response: CaseCreateResponse;
      try {
        // JSON roundtrip → `undefined` field'leri düşür (JsonBody constraint).
        const body = JSON.parse(JSON.stringify(payload));
        const raw = await apiClient("/cases", {
          method: "POST",
          body,
        });
        response = CaseCreateResponseSchema.parse(raw);
      } catch (err) {
        console.warn("useSubmitCase POST /cases failed", err);
        throw err instanceof Error ? err : new Error("case submit failed");
      }

      // Zustand mock listesine backend id + status override'ıyla ekle —
      // caller `/vaka/{id}` navigation'ında detay mock'unu bulsun.
      // PR-A3'te tüm case listing/detail backend'den gelecek; mock stub
      // o zaman kaldırılacak.
      const createdCase = useCasesStore.getState().submitDraft(kind, vehicleId, {
        id: response.id,
        status: response.status,
      });
      await invalidateCaseConsumers();
      return createdCase;
    },
  });
}

export function useCancelCaseLive(caseId: string) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient(`/cases/${caseId}/cancel`, { method: "POST" });
      await invalidateCaseConsumers();
    },
  });
}

export function useMyCasesLive() {
  return useQuery({
    queryKey: ["cases", "me", "live"],
    queryFn: async () => {
      const raw = await apiClient("/cases/me");
      return CaseSummaryResponseSchema.array().parse(raw);
    },
    staleTime: 10 * 1000,
  });
}

export function useCaseSummaryLive(caseId: string) {
  return useQuery({
    queryKey: ["cases", "summary", "live", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}`);
      return CaseSummaryResponseSchema.parse(raw);
    },
  });
}

export function useRefreshCaseMatching(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().refreshMatching(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useConfirmAppointment(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().confirmAppointment(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useCancelAppointment(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().cancelAppointment(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useCancelCase() {
  return useMutation({
    mutationFn: async (input: { caseId: string; reason?: string }) => {
      const updatedCase = useCasesStore
        .getState()
        .cancelCase(input.caseId, input.reason);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useAddCaseAttachment() {
  return useMutation({
    mutationFn: async (input: {
      caseId: string;
      attachment: CaseAttachment;
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .addAttachment(input.caseId, input.attachment);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useUpdateCaseNotes() {
  return useMutation({
    mutationFn: async (input: {
      caseId: string;
      summary?: string;
      notes?: string;
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .updateNotes(input.caseId, {
          summary: input.summary,
          notes: input.notes,
        });
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useActiveAppointmentRequestsCount() {
  const { data } = useCasesFeed();
  return (data ?? []).filter(
    (caseItem) =>
      caseItem.status === "appointment_pending" &&
      caseItem.appointment?.status === "pending",
  ).length;
}

export function useAppointmentCountdown(caseId: string) {
  const { data: caseItem } = useCaseDetail(caseId);
  const appointment = caseItem?.appointment ?? null;
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!appointment || appointment.status !== "pending") {
      return;
    }
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [appointment]);

  if (!appointment || appointment.status !== "pending") {
    return { label: null as string | null, expired: false };
  }

  const remainingMs = new Date(appointment.expires_at).getTime() - nowTs;
  if (remainingMs <= 0) {
    return { label: "Süre doldu", expired: true };
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return { label: `${hours} sa ${minutes} dk kaldı`, expired: false };
  }
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  return { label: `${minutes} dk ${seconds} sn kaldı`, expired: false };
}

export function useSendCaseMessage(caseId: string) {
  return useMutation({
    mutationFn: async ({
      body,
      attachments = [],
    }: {
      body: string;
      attachments?: CaseAttachment[];
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .sendMessage(caseId, body, attachments);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useMarkCaseSeen(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().markSeen(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export type TechnicianActionMode =
  | "request_appointment"
  | "start_case"
  | "open_case"
  | "attach_case"
  | "unavailable_busy"
  | "unavailable_cooldown";

export type TechnicianCaseAction = {
  mode: TechnicianActionMode;
  primaryLabel: string;
  primaryRoute: string;
  disabled: boolean;
  helperText?: string;
  secondaryLabel?: string;
  secondaryRoute?: string;
  attachOnPrimary: boolean;
  prefillOnPrimary: boolean;
  description: string;
  kind: ServiceRequestKind;
  caseId: string | null;
  offerId: string | null;
};

export function useTechnicianCaseAction(
  technicianId: string,
): TechnicianCaseAction {
  const { data: activeVehicle } = useActiveVehicle();
  const { data: activeCase } = useActiveCase();
  const isInCooldown = useTechnicianCooldownStore((state) =>
    technicianId ? state.isInCooldown(technicianId) : false,
  );

  const kind = getSuggestedRequestKindForVehicle(activeVehicle ?? null);
  const { data: technician } = useTechnicianPublicView(technicianId);
  const acceptingNewJobs = technician?.accepting_new_jobs ?? true;

  const isAttached = Boolean(
    activeCase &&
    (activeCase.preferred_technician_id === technicianId ||
      activeCase.assigned_technician_id === technicianId),
  );

  if (activeCase && isAttached) {
    return {
      mode: "open_case",
      primaryLabel: "Randevu Al",
      primaryRoute: `/randevu/${technicianId}?caseId=${activeCase.id}`,
      disabled: false,
      secondaryLabel: "Mesaj",
      secondaryRoute: `/vaka/${activeCase.id}/mesajlar`,
      attachOnPrimary: false,
      prefillOnPrimary: false,
      description: "Bu servis aktif vakada.",
      kind,
      caseId: activeCase.id,
      offerId: null,
    };
  }

  if (activeCase) {
    if (isInCooldown) {
      return {
        mode: "unavailable_cooldown",
        primaryLabel: "Kısa süre sonra tekrar dene",
        primaryRoute: "",
        disabled: true,
        helperText: "Bu usta son 24 saatte müsait değildi.",
        attachOnPrimary: false,
        prefillOnPrimary: false,
        description: "Cooldown aktif.",
        kind,
        caseId: activeCase.id,
        offerId: null,
      };
    }

    if (!acceptingNewJobs) {
      return {
        mode: "unavailable_busy",
        primaryLabel: "Şu an müsait değil",
        primaryRoute: "",
        disabled: true,
        helperText: "Müsait olduğunda bildirim isteyebilirsin.",
        attachOnPrimary: false,
        prefillOnPrimary: false,
        description: "Usta şu an müsait değil.",
        kind,
        caseId: activeCase.id,
        offerId: null,
      };
    }

    const route = `/randevu/${technicianId}?caseId=${activeCase.id}`;
    return {
      mode: "request_appointment",
      primaryLabel: "Randevu Al",
      primaryRoute: route,
      disabled: false,
      attachOnPrimary: true,
      prefillOnPrimary: false,
      description: "Bu usta ile randevu talebi aç.",
      kind,
      caseId: activeCase.id,
      offerId: null,
    };
  }

  return {
    mode: "start_case",
    primaryLabel: "Vaka Aç",
    primaryRoute: `/(modal)/usta-vaka/${technicianId}`,
    disabled: false,
    helperText: "Randevu için önce bakım, arıza ya da kaza vakası açılır.",
    attachOnPrimary: false,
    prefillOnPrimary: false,
    description:
      "Önce bu servise uygun bir vaka aç, sonra randevu adımına geç.",
    kind,
    caseId: null,
    offerId: null,
  };
}
