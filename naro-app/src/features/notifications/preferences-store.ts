import { create } from "zustand";

import {
  NOTIFICATION_PREFERENCES,
  type NotificationPreferenceKey,
} from "@/features/profile/data/fixtures";

type PreferenceValues = Record<NotificationPreferenceKey, boolean>;

type NotificationPreferencesState = {
  values: PreferenceValues;
  setValue: (key: NotificationPreferenceKey, value: boolean) => void;
  reset: () => void;
};

function buildDefaults(): PreferenceValues {
  return NOTIFICATION_PREFERENCES.reduce(
    (acc, pref) => ({ ...acc, [pref.key]: pref.defaultValue }),
    {} as PreferenceValues,
  );
}

export const useNotificationPreferencesStore =
  create<NotificationPreferencesState>((set) => ({
    values: buildDefaults(),
    setValue: (key, value) =>
      set((state) => ({ values: { ...state.values, [key]: value } })),
    reset: () => set({ values: buildDefaults() }),
  }));
