import { create } from "zustand";

const COOLDOWN_WINDOW_MS = 24 * 60 * 60 * 1000;
const DECLINE_THRESHOLD = 2;

type DeclineRecord = {
  count: number;
  lastAt: number;
};

type CooldownState = {
  declines: Record<string, DeclineRecord>;
  registerDecline: (technicianId: string) => void;
  isInCooldown: (technicianId: string) => boolean;
  reset: (technicianId: string) => void;
};

export const useTechnicianCooldownStore = create<CooldownState>((set, get) => ({
  declines: {},
  registerDecline: (technicianId) =>
    set((state) => {
      const existing = state.declines[technicianId];
      const now = Date.now();
      if (!existing || now - existing.lastAt > COOLDOWN_WINDOW_MS) {
        return {
          declines: { ...state.declines, [technicianId]: { count: 1, lastAt: now } },
        };
      }
      return {
        declines: {
          ...state.declines,
          [technicianId]: { count: existing.count + 1, lastAt: now },
        },
      };
    }),
  isInCooldown: (technicianId) => {
    const record = get().declines[technicianId];
    if (!record) return false;
    const now = Date.now();
    if (now - record.lastAt > COOLDOWN_WINDOW_MS) return false;
    return record.count >= DECLINE_THRESHOLD;
  },
  reset: (technicianId) =>
    set((state) => {
      const next = { ...state.declines };
      delete next[technicianId];
      return { declines: next };
    }),
}));
