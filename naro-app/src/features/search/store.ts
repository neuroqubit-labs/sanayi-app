import { create } from "zustand";

type SearchRecentState = {
  queries: string[];
  pushQuery: (query: string) => void;
  clear: () => void;
};

const MAX_RECENT = 8;

export const useSearchRecentStore = create<SearchRecentState>((set) => ({
  queries: [],
  pushQuery: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    set((state) => {
      const without = state.queries.filter(
        (q) => q.toLowerCase() !== trimmed.toLowerCase(),
      );
      return { queries: [trimmed, ...without].slice(0, MAX_RECENT) };
    });
  },
  clear: () => set({ queries: [] }),
}));
