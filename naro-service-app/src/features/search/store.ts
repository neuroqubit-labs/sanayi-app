import { create } from "zustand";

type SearchRecentState = {
  queries: string[];
  pushQuery: (q: string) => void;
  clear: () => void;
};

const MAX = 8;

export const useSearchRecentStore = create<SearchRecentState>((set) => ({
  queries: [],
  pushQuery: (q) =>
    set((state) => {
      const trimmed = q.trim();
      if (!trimmed) return state;
      const next = [
        trimmed,
        ...state.queries.filter(
          (x) => x.toLowerCase() !== trimmed.toLowerCase(),
        ),
      ].slice(0, MAX);
      return { queries: next };
    }),
  clear: () => set({ queries: [] }),
}));
