export const SERVICE_TAB_ORDER = [
  "index",
  "havuz",
  "islerim",
  "profil",
] as const;

export type ServiceTabRouteName = (typeof SERVICE_TAB_ORDER)[number];

export const SERVICE_TAB_META: Record<
  ServiceTabRouteName,
  {
    label: string;
    accessibilityLabel: string;
  }
> = {
  index: {
    label: "Anasayfa",
    accessibilityLabel: "Anasayfa sekmesi",
  },
  havuz: {
    label: "Havuz",
    accessibilityLabel: "Havuz sekmesi",
  },
  islerim: {
    label: "Kayıtlar",
    accessibilityLabel: "Kayıtlar sekmesi",
  },
  profil: {
    label: "Profil",
    accessibilityLabel: "Profil sekmesi",
  },
};
