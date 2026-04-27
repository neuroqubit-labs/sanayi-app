import { create } from "zustand";

import type { TechnicianFeedItem } from "./schemas";

type UstaPreviewState = {
  technicianId: string | null;
  feedItem: TechnicianFeedItem | null;
  open: (technicianId: string, feedItem?: TechnicianFeedItem | null) => void;
  close: () => void;
};

export const useUstaPreviewStore = create<UstaPreviewState>((set) => ({
  technicianId: null,
  feedItem: null,
  open: (technicianId, feedItem = null) => set({ technicianId, feedItem }),
  close: () => set({ technicianId: null, feedItem: null }),
}));
