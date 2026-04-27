export const CUSTOMER_TAB_ORDER = [
  "index",
  "carsi",
  "kayitlar",
  "profil",
] as const;

export type CustomerTabRouteName = (typeof CUSTOMER_TAB_ORDER)[number];

export const CUSTOMER_TAB_META: Record<
  CustomerTabRouteName,
  {
    label: string;
    accessibilityLabel: string;
  }
> = {
  index: {
    label: "Ana Sayfa",
    accessibilityLabel: "Ana sayfa sekmesi",
  },
  carsi: {
    label: "Çarşı",
    accessibilityLabel: "Çarşı sekmesi",
  },
  kayitlar: {
    label: "Kayıtlar",
    accessibilityLabel: "Kayıtlar sekmesi",
  },
  profil: {
    label: "Hesap",
    accessibilityLabel: "Hesap sekmesi",
  },
};
