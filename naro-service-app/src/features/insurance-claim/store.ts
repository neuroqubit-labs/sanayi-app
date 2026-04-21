import { create } from "zustand";

import { emptyClaimDraft, type ClaimDraft } from "./types";

type SourceMode = "unselected" | "standalone" | "from_case";

type ClaimDraftStore = {
  draft: ClaimDraft;
  sourceMode: SourceMode;
  update: (patch: Partial<ClaimDraft>) => void;
  setSourceMode: (mode: SourceMode) => void;
  reset: () => void;
};

export const useClaimDraftStore = create<ClaimDraftStore>((set) => ({
  draft: emptyClaimDraft(),
  sourceMode: "unselected",
  update: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  setSourceMode: (mode) => set({ sourceMode: mode }),
  reset: () => set({ draft: emptyClaimDraft(), sourceMode: "unselected" }),
}));
