import { create } from "zustand";

type VehicleState = {
  activeVehicleId: string;
  setActiveVehicle: (id: string) => void;
};

/**
 * Yalnız **seçim durumu** (hangi araç aktif). Araç listesi kaynağı
 * TanStack Query üstünden `/vehicles/me` endpoint'inden gelir
 * (naro-app/src/features/vehicles/api.ts).
 *
 * Mock vehicles fixture + addVehicle mock silindi; mobil live wire-up
 * PR-C (brief docs/mobil-live-wire-up-brief.md §PR-C).
 */
export const useVehicleStore = create<VehicleState>((set) => ({
  activeVehicleId: "",
  setActiveVehicle: (id) => set({ activeVehicleId: id }),
}));
