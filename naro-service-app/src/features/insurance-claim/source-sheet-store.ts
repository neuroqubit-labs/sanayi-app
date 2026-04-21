import { create } from "zustand";

type SourceSheetState = {
  open: boolean;
  show: () => void;
  close: () => void;
};

export const useClaimSourceSheetStore = create<SourceSheetState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
