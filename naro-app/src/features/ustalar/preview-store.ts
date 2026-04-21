import { create } from "zustand";

type UstaPreviewState = {
  technicianId: string | null;
  open: (technicianId: string) => void;
  close: () => void;
};

export const useUstaPreviewStore = create<UstaPreviewState>((set) => ({
  technicianId: null,
  open: (technicianId) => set({ technicianId }),
  close: () => set({ technicianId: null }),
}));
