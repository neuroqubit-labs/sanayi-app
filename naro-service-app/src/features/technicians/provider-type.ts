import type { BrandTier, ProviderType, ServiceDomain } from "@naro/domain";

export type ProviderTypeMeta = {
  key: ProviderType;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  supportsCampaigns: boolean;
  supportsInsuranceCreation: boolean;
  recommendedCapabilities: {
    insurance_case_handler?: boolean;
    on_site_repair?: boolean;
    valet_service?: boolean;
    towing_coordination?: boolean;
  };
  recommendedDomains: ServiceDomain[];
  recommendedBrandTiers: BrandTier[];
};

export const PROVIDER_TYPE_META: Record<ProviderType, ProviderTypeMeta> = {
  usta: {
    key: "usta",
    label: "Genel Usta / Sanayi",
    shortLabel: "Genel Usta",
    description:
      "Atölye bazlı bakım, mekanik ve elektrik onarım yapan geleneksel sanayi servisleri.",
    icon: "wrench",
    supportsCampaigns: true,
    supportsInsuranceCreation: true,
    recommendedCapabilities: {
      insurance_case_handler: true,
      valet_service: true,
    },
    recommendedDomains: ["motor", "sanziman", "fren", "elektrik", "klima"],
    recommendedBrandTiers: ["mass", "premium"],
  },
  cekici: {
    key: "cekici",
    label: "Çekici / Yol Yardımı",
    shortLabel: "Çekici",
    description:
      "Kaza, arıza ve transfer anında aracı güvenle taşır. Şehir içi ve uzun yol yardımı.",
    icon: "truck",
    supportsCampaigns: false,
    supportsInsuranceCreation: true,
    recommendedCapabilities: {
      towing_coordination: true,
    },
    recommendedDomains: ["cekici"],
    recommendedBrandTiers: ["mass", "premium", "luxury", "commercial"],
  },
  oto_aksesuar: {
    key: "oto_aksesuar",
    label: "Oto Aksesuar",
    shortLabel: "Aksesuar",
    description:
      "Aracın estetik ve konfor ekipmanları: cam filmi, multimedya, kaplama, döşeme vb.",
    icon: "sparkles",
    supportsCampaigns: false,
    supportsInsuranceCreation: false,
    recommendedCapabilities: {
      on_site_repair: true,
    },
    recommendedDomains: ["aksesuar", "cam"],
    recommendedBrandTiers: ["mass"],
  },
  kaporta_boya: {
    key: "kaporta_boya",
    label: "Kaporta & Boya",
    shortLabel: "Kaporta",
    description:
      "Kaza sonrası kaporta düzeltme, boya ve karoseri restorasyonu yapan servisler.",
    icon: "spray-can",
    supportsCampaigns: true,
    supportsInsuranceCreation: true,
    recommendedCapabilities: {
      insurance_case_handler: true,
      valet_service: true,
    },
    recommendedDomains: ["kaporta", "cam"],
    recommendedBrandTiers: ["mass", "premium", "luxury"],
  },
  lastik: {
    key: "lastik",
    label: "Lastik & Rot Balans",
    shortLabel: "Lastik",
    description:
      "Lastik satış / değişim, rot balans, jant onarımı ve mevsimlik bakım.",
    icon: "circle-dot",
    supportsCampaigns: true,
    supportsInsuranceCreation: false,
    recommendedCapabilities: {
      on_site_repair: true,
    },
    recommendedDomains: ["lastik", "suspansiyon"],
    recommendedBrandTiers: ["mass", "premium"],
  },
  oto_elektrik: {
    key: "oto_elektrik",
    label: "Oto Elektrik & Elektronik",
    shortLabel: "Oto Elektrik",
    description:
      "Araç elektrik sistemleri, ECU programlama, akü, alternatör, multimedya arızaları.",
    icon: "zap",
    supportsCampaigns: true,
    supportsInsuranceCreation: false,
    recommendedCapabilities: {
      on_site_repair: true,
    },
    recommendedDomains: ["elektrik", "aku"],
    recommendedBrandTiers: ["mass", "premium"],
  },
};

export const PROVIDER_TYPE_ORDER: ProviderType[] = [
  "usta",
  "cekici",
  "kaporta_boya",
  "lastik",
  "oto_elektrik",
  "oto_aksesuar",
];

export function getProviderTypeMeta(type: ProviderType): ProviderTypeMeta {
  return PROVIDER_TYPE_META[type];
}

export function resolveCampaignVisibility(type: ProviderType): boolean {
  return PROVIDER_TYPE_META[type].supportsCampaigns;
}

export function resolveInsuranceCreationVisibility(type: ProviderType): boolean {
  return PROVIDER_TYPE_META[type].supportsInsuranceCreation;
}
