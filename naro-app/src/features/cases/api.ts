import type {
  CaseAttachment,
  ServiceCase,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import {
  ApiError,
  invalidateCaseDossier,
  type ApiRequestOptions,
} from "@naro/mobile-core";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useTechnicianPublicView } from "@/features/ustalar/api";
import { useActiveVehicle } from "@/features/vehicles";
import type { Vehicle } from "@/features/vehicles/types";
import { apiClient, useAuthStore } from "@/runtime";
import { mockDelay } from "@/shared/lib/mock";
import { queryClient } from "@/shared/lib/query";

import { useTechnicianCooldownStore } from "./cooldown-store";
import { createDraftForKind } from "./data/fixtures";
import {
  CaseCreateResponseSchema,
  CaseDetailResponseSchema,
  CaseSummaryResponseSchema,
  ServiceRequestDraftCreateSchema,
  type CaseCreateResponse,
  type CaseDetailResponse,
  type LatLngPayload,
  type ServiceRequestDraftCreate,
  type TowEquipment,
  type TowIncidentReason,
  type TowMode,
} from "./schemas/case-create";
import {
  ThreadMessageCreatePayloadSchema,
  ThreadMessageListResponseSchema,
  ThreadMessageResponseSchema,
  type ThreadMessageListResponse,
  type ThreadMessageResponse,
  type ThreadSendErrorDetail,
} from "./schemas/thread";
import {
  CaseDocumentListResponseSchema,
  CaseEventListResponseSchema,
  type CaseDocumentItem,
  type CaseEventItem,
  type CaseEventListResponse,
} from "./schemas/timeline";
import { useCasesStore } from "./store";

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

export type NotifyCaseToTechnicianVariables = {
  caseId: string;
  technicianProfileId?: string;
  technicianId?: string;
  note?: string | null;
};

export function useNotifyCaseToTechnician() {
  return useMutation({
    mutationFn: async ({
      caseId,
      technicianProfileId,
      technicianId,
      note = null,
    }: NotifyCaseToTechnicianVariables) => {
      const targetId = technicianProfileId ?? technicianId;
      if (!targetId) {
        throw new ApiError("technician_profile_id_required", "parse", "local");
      }
      const body: ApiRequestOptions<unknown>["body"] = technicianProfileId
        ? { technician_profile_id: technicianProfileId, note }
        : { technician_id: targetId, note };
      const response = await apiClient(
        `/cases/${caseId}/notify-technicians`,
        {
          method: "POST",
          body,
        },
      );
      return response as {
        notification_id: string;
        match_id: string | null;
        case_id: string;
        technician_profile_id: string;
        technician_id: string;
        status: string;
        notify_state: string;
      };
    },
    onSuccess: async (_result, variables) => {
      await invalidateCaseConsumers();
      await invalidateCaseDossier(queryClient, variables.caseId);
    },
  });
}

export function useCasesFeed() {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? "";

  return useQuery<ServiceCase[]>({
    queryKey: ["cases", "feed", vehicleId],
    queryFn: () => {
      if (!vehicleId) return [];
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

export function useCreateCaseDraft(kind: ServiceRequestKind) {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? "";

  const query = useQuery<ServiceRequestDraft>({
    queryKey: ["cases", "draft", kind, vehicleId],
    queryFn: async () => {
      if (!vehicleId) {
        throw new Error("Talep için aktif araç gerekli.");
      }
      const draft = useCasesStore.getState().getDraft(kind, vehicleId);
      return mockDelay(draft);
    },
    enabled: Boolean(vehicleId),
    initialData: vehicleId ? createDraftForKind(kind, vehicleId) : undefined,
  });

  return {
    ...query,
    updateDraft: (patch: Partial<ServiceRequestDraft>) => {
      if (!vehicleId) {
        throw new Error("Talep için aktif araç gerekli.");
      }
      const draft = useCasesStore.getState().updateDraft(kind, patch);
      queryClient.setQueryData(["cases", "draft", kind, vehicleId], draft);
      void queryClient.invalidateQueries({
        queryKey: ["cases", "draft", kind, vehicleId],
      });
      return draft;
    },
    resetDraft: () => {
      if (!vehicleId) {
        throw new Error("Talep için aktif araç gerekli.");
      }
      const draft = useCasesStore.getState().resetDraft(kind, vehicleId);
      queryClient.setQueryData(["cases", "draft", kind, vehicleId], draft);
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

export type CanonicalTowSubmitContext = {
  mode: TowMode;
  pickupLatLng: LatLngPayload;
  dropoffLatLng: LatLngPayload;
  requiredEquipment: TowEquipment[];
  incidentReason: TowIncidentReason;
  scheduledAt: string | null;
  fareQuote: Record<string, unknown>;
  parentCaseId: string | null;
};

export type SubmitCaseVariables = {
  towing?: CanonicalTowSubmitContext;
};

/**
 * Subtype-aware payload adapter — İŞ 2 (2026-04-23).
 *
 * BE Faz 1c subtype dispatch canlı: POST /cases kind'a göre subtype
 * tabloya yazıyor. FE draft'ın subtype-relevant alanlarını payload'a
 * taşır; forbidden alanları kind başına default'a zorlar (BE
 * _KIND_FIELD_RULES ihlali olmasın).
 *
 * Matching-audit P0-5: damage_severity, maintenance_detail,
 * attachment.category artık gerçek payload'a gidiyor (eski hardcoded
 * null'lar kaldırıldı).
 */
function draftToCreatePayload(
  draft: ServiceRequestDraft,
  kind: ServiceRequestKind,
  vehicleId: string,
  variables?: SubmitCaseVariables,
): ServiceRequestDraftCreate {
  const attachments = draft.attachments.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle ?? null,
    statusLabel: item.statusLabel ?? null,
    asset_id: item.asset?.id ?? null,
    category: item.category ?? null,
  }));

  // Ortak alanlar (tüm kind'lar için geçerli)
  const base = {
    schema_version: "v1" as const,
    kind,
    vehicle_id: vehicleId,
    urgency: draft.urgency ?? "planned",
    summary: deriveSummary(draft, kind),
    location_label: draft.location_label?.trim() || "Konum belirtilmedi",
    location_lat_lng: draft.location_lat_lng ?? null,
    notes: draft.notes ?? null,
    attachments,
    preferred_window: draft.preferred_window ?? null,
    mileage_km: draft.mileage_km ?? null,
    preferred_technician_id: draft.preferred_technician_id ?? null,
    towing_required:
      kind === "accident" ? (draft.towing_required ?? false) : false,
  };

  // Tüm subtype-specific alanlar default'larla başla; aşağıda kind'a göre
  // sadece ilgili olanlar draft'tan doldurulur.
  const subtypeDefaults = {
    dropoff_label: null as string | null,
    dropoff_lat_lng: draft.dropoff_lat_lng ?? null,
    symptoms: [] as string[],
    maintenance_items: [] as string[],
    vehicle_drivable: null as boolean | null,
    pickup_preference: null as ServiceRequestDraftCreate["pickup_preference"],
    counterparty_note: null as string | null,
    counterparty_vehicle_count: null as number | null,
    damage_area: null as string | null,
    damage_severity:
      null as ServiceRequestDraftCreate["damage_severity"],
    valet_requested: false,
    report_method: null as ServiceRequestDraftCreate["report_method"],
    kasko_selected: false,
    kasko_brand: null as string | null,
    sigorta_selected: false,
    sigorta_brand: null as string | null,
    ambulance_contacted: false,
    emergency_acknowledged: false,
    breakdown_category:
      null as ServiceRequestDraftCreate["breakdown_category"],
    on_site_repair: false,
    price_preference:
      null as ServiceRequestDraftCreate["price_preference"],
    maintenance_category:
      null as ServiceRequestDraftCreate["maintenance_category"],
    maintenance_detail: null as Record<string, unknown> | null,
    maintenance_tier: null as string | null,
    tow_mode: null as ServiceRequestDraftCreate["tow_mode"],
    tow_required_equipment:
      [] as ServiceRequestDraftCreate["tow_required_equipment"],
    tow_incident_reason:
      null as ServiceRequestDraftCreate["tow_incident_reason"],
    tow_scheduled_at: null as string | null,
    tow_parent_case_id: null as string | null,
    tow_fare_quote: null as Record<string, unknown> | null,
  };

  const subtypePayload = (() => {
    switch (kind) {
      case "accident":
        return {
          ...subtypeDefaults,
          counterparty_note: draft.counterparty_note ?? null,
          counterparty_vehicle_count:
            draft.counterparty_vehicle_count ?? null,
          damage_area: draft.damage_area ?? null,
          damage_severity: draft.damage_severity ?? null,
          report_method: draft.report_method ?? null,
          kasko_selected: draft.kasko_selected ?? false,
          kasko_brand: draft.kasko_brand ?? null,
          sigorta_selected: draft.sigorta_selected ?? false,
          sigorta_brand: draft.sigorta_brand ?? null,
          ambulance_contacted: draft.ambulance_contacted ?? false,
          emergency_acknowledged: draft.emergency_acknowledged ?? true,
        };
      case "breakdown":
        return {
          ...subtypeDefaults,
          symptoms: draft.symptoms ?? [],
          vehicle_drivable: null,
          breakdown_category: draft.breakdown_category ?? null,
          on_site_repair: draft.on_site_repair ?? false,
          valet_requested: draft.valet_requested ?? false,
          pickup_preference: draft.pickup_preference ?? null,
          price_preference: draft.price_preference ?? null,
        };
      case "maintenance":
        return {
          ...subtypeDefaults,
          maintenance_items: draft.maintenance_items ?? [],
          maintenance_category: draft.maintenance_category ?? null,
          maintenance_detail: draft.maintenance_detail ?? null,
          maintenance_tier: draft.maintenance_tier ?? null,
          valet_requested: draft.valet_requested ?? false,
          pickup_preference: draft.pickup_preference ?? null,
          price_preference: draft.price_preference ?? null,
          mileage_km: draft.mileage_km ?? null,
        };
      case "towing":
        if (!variables?.towing) {
          throw new Error("Çekici talebi için canlı çekici bağlamı eksik.");
        }
        return {
          ...subtypeDefaults,
          location_lat_lng: variables.towing.pickupLatLng,
          dropoff_label: draft.dropoff_label?.trim() || null,
          dropoff_lat_lng: variables.towing.dropoffLatLng,
          vehicle_drivable: draft.vehicle_drivable ?? null,
          tow_mode: variables.towing.mode,
          tow_required_equipment: variables.towing.requiredEquipment,
          tow_incident_reason: variables.towing.incidentReason,
          tow_scheduled_at: variables.towing.scheduledAt,
          tow_parent_case_id: variables.towing.parentCaseId,
          tow_fare_quote: variables.towing.fareQuote,
        };
    }
  })();

  return ServiceRequestDraftCreateSchema.parse({
    ...base,
    ...subtypePayload,
  });
}

export function useSubmitCase(kind: ServiceRequestKind) {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? "";

  return useMutation<CaseCreateResponse, Error, SubmitCaseVariables | void>({
    mutationFn: async (variables) => {
      if (!vehicleId) {
        throw new Error("Talep oluşturmak için aktif araç gerekli.");
      }
      const storeState = useCasesStore.getState();
      const draft =
        storeState.drafts[kind] ??
        (() => {
          throw new Error("Draft eksik — composer'ı sıfırdan başlat.");
        })();

      // Evidence-first invariant (I-6) — attachment ownership + kind-bazlı
      // zorunlu alan kontrolü backend yanında tekrar enforce. FE burada
      // Zod parse ile temel şekli garanti eder; 422 detayı backend'den gelir.
      const payload = draftToCreatePayload(
        draft,
        kind,
        vehicleId,
        variables ?? undefined,
      );

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

      // Draft reset post-submit — composer kapanır, taslak boşa düşer
      // (yeniden açılırsa kullanıcı sıfırdan başlar). setQueryData ile
      // cache anında fresh, invalidate ek refetch'i de tetikler.
      const freshDraft = useCasesStore
        .getState()
        .resetDraft(kind, vehicleId);
      queryClient.setQueryData(
        ["cases", "draft", kind, vehicleId],
        freshDraft,
      );

      await invalidateCaseConsumers();
      return response;
    },
  });
}

/**
 * Auth-ready guard — TanStack Query'nin `enabled`'i tetiklenmeden önce
 * hydrate tamamlanıp accessToken'ın bulunmasını bekler. Login ekranda
 * global sheet'ler mount olduğunda protected hook'ların fırlamaması
 * için (QA tur 0 T3 fail).
 */
function useAuthReady(): boolean {
  return useAuthStore((s) => s.hydrated && Boolean(s.accessToken));
}

export function useMyCasesLive() {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["cases", "me", "live"],
    enabled: authReady,
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

/**
 * BE Faz 2 (2026-04-23): canonical case detail.
 * Döner `parent_case_id` (tow → accident/breakdown) ve
 * `linked_tow_case_ids[]` (accident/breakdown → tow reverse lookup).
 * Linked tow CTA + vehicle snapshot + subtype dict tüketicisi.
 */
export function useCaseDetailLive(caseId: string) {
  return useQuery<CaseDetailResponse>({
    queryKey: ["cases", "detail", "live", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}`);
      return CaseDetailResponseSchema.parse(raw);
    },
  });
}

// ─── İş A thread + notes live wrappers (2026-04-23) ─────────────────────────

/**
 * FastAPI HTTPException → `ApiError.body = { detail: {...} }`. BE thread
 * contract iki özel detail tipi döner: disintermediation (422) ve
 * case_closed (403). Helper tek tipe normalize eder; caller UX'te switch.
 */
export function extractThreadSendError(
  err: unknown,
): ThreadSendErrorDetail | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body as { detail?: unknown } | undefined;
  const detail = body?.detail;
  if (!detail || typeof detail !== "object") return null;
  const type = (detail as { type?: unknown }).type;
  const message = (detail as { message?: unknown }).message;
  if (typeof type !== "string" || typeof message !== "string") return null;
  if (
    type === "disintermediation_phone_number" ||
    type === "disintermediation_email" ||
    type === "case_closed"
  ) {
    return { type, message };
  }
  return null;
}

const THREAD_PAGE_LIMIT = 50;

/**
 * Thread mesajları — cursor paginated (base64 cursor, 50 limit).
 * BE `next_cursor=null` → son sayfa. Flat array erişimi için
 * `data.pages.flatMap(p => p.items)` ile kullan.
 */
export function useCaseThreadLive(caseId: string) {
  return useInfiniteQuery({
    queryKey: ["cases", "thread", "live", caseId],
    enabled: caseId.length > 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(THREAD_PAGE_LIMIT),
      });
      if (pageParam) params.set("cursor", pageParam);
      const raw = await apiClient(
        `/cases/${caseId}/thread/messages?${params.toString()}`,
      );
      return ThreadMessageListResponseSchema.parse(raw);
    },
    getNextPageParam: (lastPage: ThreadMessageListResponse) =>
      lastPage.next_cursor ?? undefined,
    staleTime: 5 * 1000,
  });
}

/**
 * Thread'e yeni mesaj. BE validate (telefon/email regex) → 422
 * disintermediation; terminal case → 403 case_closed. Caller hatayı
 * `extractThreadSendError` ile tipleyip UX'te yönlendirir.
 */
export function useSendCaseMessageLive(caseId: string) {
  return useMutation<ThreadMessageResponse, Error, { content: string }>({
    mutationFn: async (input) => {
      const body = ThreadMessageCreatePayloadSchema.parse({
        content: input.content,
      });
      const raw = await apiClient(`/cases/${caseId}/thread/messages`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return ThreadMessageResponseSchema.parse(raw);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["cases", "thread", "live", caseId],
      });
      // Detail timestamp refresh — message send last-seen side-effect.
      void queryClient.invalidateQueries({
        queryKey: ["cases", "detail", "live", caseId],
      });
    },
  });
}

/**
 * Thread'i okundu işaretle — BE 204. CaseThreadScreen focus event'te
 * debounce 500ms + çağır; hızlı tetiklemede race yok (idempotent).
 */
export function useMarkCaseThreadSeenLive(caseId: string) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient(`/cases/${caseId}/thread/seen`, {
        method: "POST",
      });
    },
  });
}

// ─── İş 5 timeline live hooks (2026-04-23) — documents + events ────────────

/**
 * Case belgeleri — BE source-of-truth `media_assets.linked_case_id`.
 * Pilot V1 cursor yok (küçük set); V1.1 cursor eklenir.
 */
export function useCaseDocumentsLive(caseId: string) {
  return useQuery<CaseDocumentItem[]>({
    queryKey: ["cases", "documents", "live", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/cases/${caseId}/documents`);
      return CaseDocumentListResponseSchema.parse(raw).items;
    },
    staleTime: 15 * 1000,
  });
}

/**
 * Case events timeline — BE append-only `case_events`. ASC cursor
 * paginated (50/page). Engine canonical milestones + evidence_feed
 * derivation'u için primary stream.
 */
const EVENTS_PAGE_LIMIT = 50;

export function useCaseEventsLive(caseId: string) {
  return useInfiniteQuery({
    queryKey: ["cases", "events", "live", caseId],
    enabled: caseId.length > 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(EVENTS_PAGE_LIMIT) });
      if (pageParam) params.set("cursor", pageParam);
      const raw = await apiClient(
        `/cases/${caseId}/events?${params.toString()}`,
      );
      return CaseEventListResponseSchema.parse(raw);
    },
    getNextPageParam: (lastPage: CaseEventListResponse) =>
      lastPage.next_cursor ?? undefined,
    staleTime: 10 * 1000,
  });
}

/**
 * Flatten helper — useInfiniteQuery output → tek array (ASC kronolojik).
 */
export function flattenCaseEvents(
  data: ReturnType<typeof useCaseEventsLive>["data"],
): CaseEventItem[] {
  const pages = data?.pages ?? [];
  return pages.flatMap((p) => p.items);
}

/**
 * Müşteri notları güncelle (owner-only). BE response güncel
 * CaseDetailResponse döner → cache set + detail query invalidate.
 * Null content → notes silme.
 */
export function useUpdateCaseNotesLive(caseId: string) {
  return useMutation<CaseDetailResponse, Error, { content: string | null }>({
    mutationFn: async (input) => {
      const raw = await apiClient(`/cases/${caseId}/notes`, {
        method: "PATCH",
        body: { content: input.content },
      });
      return CaseDetailResponseSchema.parse(raw);
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(
        ["cases", "detail", "live", caseId],
        detail,
      );
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
  | "notify_case"
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
    activeCase && activeCase.assigned_technician_id === technicianId,
  );

  if (activeCase && isAttached) {
    return {
      mode: "open_case",
      primaryLabel: "Vaka Detayını Aç",
      primaryRoute: `/vaka/${activeCase.id}`,
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

    return {
      mode: "open_case",
      primaryLabel: "Vaka profilini aç",
      primaryRoute: `/vaka/${activeCase.id}`,
      disabled: false,
      attachOnPrimary: false,
      prefillOnPrimary: false,
      description:
        "Bildirilebilir servis kararı backend match context'iyle vaka profilinde verilir.",
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
