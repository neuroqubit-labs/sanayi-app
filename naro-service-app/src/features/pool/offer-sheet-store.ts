import { create } from "zustand";

type OfferSheetState = {
  caseId: string | null;
  open: (caseId: string) => void;
  close: () => void;
};

export const useOfferSheetStore = create<OfferSheetState>((set) => ({
  caseId: null,
  open: (caseId) => set({ caseId }),
  close: () => set({ caseId: null }),
}));
