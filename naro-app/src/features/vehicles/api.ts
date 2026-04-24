import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiClient, useAuthStore } from "@/runtime";

import {
  HistoryConsentPayloadSchema,
  VehicleCreatePayloadSchema,
  VehicleDossierSchema,
  VehicleListSchema,
  VehicleResponseSchema,
  VehicleUpdatePayloadSchema,
  type HistoryConsentPayload,
  type VehicleCreatePayload,
  type VehicleDossier,
  type VehicleResponse,
  type VehicleUpdatePayload,
} from "./schema";
import { useVehicleStore } from "./store";
import type { Vehicle, VehicleDraft } from "./types";

function draftToPayload(draft: VehicleDraft): VehicleCreatePayload {
  if (!draft.vehicleKind) {
    throw new Error("Vehicle kind is required");
  }
  return VehicleCreatePayloadSchema.parse({
    plate: draft.plate.trim().toUpperCase(),
    vehicle_kind: draft.vehicleKind,
    make: draft.make.trim() || null,
    model: draft.model.trim() || null,
    year: draft.year ?? null,
    color: draft.color?.trim() || null,
    fuel_type: draft.fuel ?? null,
    transmission: draft.transmission ?? null,
    drivetrain: draft.drivetrain ?? null,
    engine_displacement: draft.engineDisplacement?.trim() || null,
    engine_power_hp: draft.enginePowerHp ?? null,
    chassis_no: draft.chassisNo?.trim() || null,
    engine_no: draft.engineNo?.trim() || null,
    photo_url: draft.photoUri || null,
    vin: null,
    current_km: draft.mileageKm ?? null,
    note: draft.note?.trim() || null,
    is_primary: true,
  });
}

/**
 * Backend VehicleResponse → UI Vehicle shape adapter.
 *
 * UI-spesifik alanlar (history[], warranties[], maintenanceReminders[],
 * healthLabel, lastServiceLabel vb.) backend'de yok; boş varsayılır.
 * İlerleyen PR'larda `/vehicles/{id}/dossier` + case feed'den türer.
 */
function adaptVehicle(
  res: VehicleResponse,
  activeVehicleId: string,
): Vehicle {
  return {
    id: res.id,
    plate: res.plate,
    photoUri: res.photo_url ?? undefined,
    tabThumbnailUri: res.photo_url ?? undefined,
    vehicleKind: res.vehicle_kind ?? undefined,
    make: res.make ?? "",
    model: res.model ?? "",
    year: res.year ?? new Date().getFullYear(),
    color: res.color ?? undefined,
    fuel: res.fuel_type === "other" ? undefined : res.fuel_type ?? undefined,
    transmission: res.transmission ?? undefined,
    drivetrain: res.drivetrain ?? undefined,
    engineDisplacement: res.engine_displacement ?? undefined,
    enginePowerHp: res.engine_power_hp ?? undefined,
    chassisNo: res.chassis_no ?? undefined,
    engineNo: res.engine_no ?? undefined,
    mileageKm: res.current_km ?? 0,
    note: res.note ?? undefined,
    healthLabel: undefined,
    isActive: res.id === activeVehicleId,
    lastServiceLabel: undefined,
    nextServiceLabel: undefined,
    regularShop: undefined,
    insuranceExpiryLabel: res.kasko_valid_until
      ? new Date(res.kasko_valid_until).toLocaleDateString("tr-TR")
      : undefined,
    chronicNotes: [],
    history: [],
    warranties: [],
    maintenanceReminders: [],
    historyAccessGranted: res.history_consent_granted,
  };
}

async function fetchMyVehicles(): Promise<VehicleResponse[]> {
  const raw = await apiClient("/vehicles/me");
  return VehicleListSchema.parse(raw);
}

async function fetchVehicle(id: string): Promise<VehicleResponse> {
  const raw = await apiClient(`/vehicles/${id}`);
  return VehicleResponseSchema.parse(raw);
}

async function fetchVehicleDossier(id: string): Promise<VehicleDossier> {
  const raw = await apiClient(`/vehicles/${id}/dossier`);
  return VehicleDossierSchema.parse(raw);
}

export function useVehicles() {
  const activeVehicleId = useVehicleStore((s) => s.activeVehicleId);
  const setActiveVehicle = useVehicleStore((s) => s.setActiveVehicle);
  // QA tur 0 T3 fix (2026-04-23): login ekranda global
  // VehicleSwitcherSheet mount'u `/vehicles/me` 401 attırıyordu.
  // authReady gate → hydrate + accessToken şartını bekle.
  const authReady = useAuthStore(
    (s) => s.hydrated && Boolean(s.accessToken),
  );

  const query = useQuery<VehicleResponse[]>({
    queryKey: ["vehicles", "me"],
    enabled: authReady,
    queryFn: fetchMyVehicles,
    staleTime: 30 * 1000,
  });

  // Aktif araç seçilmemişse ve liste doluysa ilkini seç
  useEffect(() => {
    if (!activeVehicleId && query.data && query.data.length > 0) {
      setActiveVehicle(query.data[0]!.id);
    }
  }, [activeVehicleId, query.data, setActiveVehicle]);

  return {
    ...query,
    data: (query.data ?? []).map((v) => adaptVehicle(v, activeVehicleId)),
  };
}

export function useActiveVehicle() {
  const activeVehicleId = useVehicleStore((s) => s.activeVehicleId);
  const vehiclesQuery = useVehicles();
  const active =
    vehiclesQuery.data.find((v) => v.id === activeVehicleId) ??
    vehiclesQuery.data[0] ??
    null;
  return {
    ...vehiclesQuery,
    data: active as Vehicle | null,
  };
}

export function useVehicle(vehicleId: string) {
  const activeVehicleId = useVehicleStore((s) => s.activeVehicleId);

  return useQuery<Vehicle | null>({
    queryKey: ["vehicles", vehicleId],
    enabled: vehicleId.length > 0,
    queryFn: async () => {
      const res = await fetchVehicle(vehicleId);
      return adaptVehicle(res, activeVehicleId);
    },
  });
}

export function useVehicleDossierQuery(vehicleId: string) {
  return useQuery<VehicleDossier>({
    queryKey: ["vehicles", vehicleId, "dossier"],
    enabled: vehicleId.length > 0,
    queryFn: () => fetchVehicleDossier(vehicleId),
  });
}

export function useAddVehicle() {
  const queryClient = useQueryClient();
  const setActiveVehicle = useVehicleStore((s) => s.setActiveVehicle);

  return useMutation<Vehicle, Error, VehicleDraft>({
    mutationFn: async (draft) => {
      const payload = draftToPayload(draft);
      const raw = await apiClient("/vehicles", {
        method: "POST",
        body: payload,
      });
      const created = VehicleResponseSchema.parse(raw);

      // İzin verildiyse history-consent ayrı POST (backend contract)
      if (draft.historyAccessGranted) {
        await apiClient(`/vehicles/${created.id}/history-consent`, {
          method: "POST",
          body: HistoryConsentPayloadSchema.parse({ granted: true }),
        });
      }

      setActiveVehicle(created.id);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      return adaptVehicle(created, created.id);
    },
  });
}

export function useUpdateVehicleMutation(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation<VehicleResponse, Error, VehicleUpdatePayload>({
    mutationFn: async (payload) => {
      const body = VehicleUpdatePayloadSchema.parse(payload);
      const raw = await apiClient(`/vehicles/${vehicleId}`, {
        method: "PATCH",
        body,
      });
      return VehicleResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

export function useDeleteVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (vehicleId) => {
      await apiClient(`/vehicles/${vehicleId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

export function useHistoryConsentMutation(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation<VehicleResponse, Error, HistoryConsentPayload>({
    mutationFn: async (payload) => {
      const body = HistoryConsentPayloadSchema.parse(payload);
      const raw = await apiClient(`/vehicles/${vehicleId}/history-consent`, {
        method: "POST",
        body,
      });
      return VehicleResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}
