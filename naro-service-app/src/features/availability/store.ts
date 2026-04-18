import { create } from "zustand";

type AvailabilityState = {
  isAvailable: boolean;
  toggle: () => void;
  setAvailable: (value: boolean) => void;
};

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  isAvailable: true,
  toggle: () => set((s) => ({ isAvailable: !s.isAvailable })),
  setAvailable: (value) => set({ isAvailable: value }),
}));
