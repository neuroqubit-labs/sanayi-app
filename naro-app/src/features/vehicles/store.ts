import { create } from "zustand";

import { mockVehicles } from "./data/fixtures";
import type { Vehicle, VehicleDraft } from "./types";

type VehicleState = {
  vehicles: Vehicle[];
  activeVehicleId: string;
  setActiveVehicle: (id: string) => void;
  addVehicle: (draft: VehicleDraft) => Vehicle;
};

const defaultActiveVehicleId =
  mockVehicles.find((vehicle) => vehicle.isActive)?.id ??
  mockVehicles[0]?.id ??
  "";

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toVehicle(draft: VehicleDraft): Vehicle {
  return {
    id: nextId("veh"),
    plate: draft.plate.trim().toUpperCase(),
    tabThumbnailUri: draft.tabThumbnailUri,
    make: draft.make.trim(),
    model: draft.model.trim(),
    year: draft.year ?? new Date().getFullYear(),
    color: draft.color,
    fuel: draft.fuel,
    transmission: draft.transmission,
    engine: draft.engine,
    mileageKm: draft.mileageKm ?? 0,
    note: draft.note,
    healthLabel: "Yeni eklendi",
    isActive: false,
    lastServiceLabel: undefined,
    nextServiceLabel: undefined,
    regularShop: undefined,
    insuranceExpiryLabel: undefined,
    chronicNotes: draft.chronicNotes ?? [],
    history: [],
    warranties: [],
    maintenanceReminders: [],
    historyAccessGranted: draft.historyAccessGranted ?? false,
  };
}

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: mockVehicles,
  activeVehicleId: defaultActiveVehicleId,
  setActiveVehicle: (id) => set({ activeVehicleId: id }),
  addVehicle: (draft) => {
    const vehicle = toVehicle(draft);

    set((state) => ({
      vehicles: [...state.vehicles, vehicle],
      activeVehicleId: state.activeVehicleId || vehicle.id,
    }));

    return vehicle;
  },
}));
