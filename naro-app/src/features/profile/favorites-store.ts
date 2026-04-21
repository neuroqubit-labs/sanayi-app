import { create } from "zustand";

const DEFAULT_FAVORITES = ["tech-autopro-servis", "tech-fatih-kaporta"] as const;

type FavoriteTechniciansState = {
  ids: string[];
  toggle: (id: string) => void;
  isFavorite: (id: string) => boolean;
};

export const useFavoriteTechniciansStore = create<FavoriteTechniciansState>(
  (set, get) => ({
    ids: [...DEFAULT_FAVORITES],
    toggle: (id) =>
      set((state) => ({
        ids: state.ids.includes(id)
          ? state.ids.filter((existing) => existing !== id)
          : [...state.ids, id],
      })),
    isFavorite: (id) => get().ids.includes(id),
  }),
);
