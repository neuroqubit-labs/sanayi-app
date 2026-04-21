import type {
  HomeLayout,
  ProviderMode,
  ProviderType,
  QuickAction,
  TechnicianCertificateKind,
} from "@naro/domain";

// ───────── home_layout per (provider_type, provider_mode) ─────────

function roleKey(type: ProviderType, mode: ProviderMode): string {
  return `${type}__${mode}`;
}

const HOME_LAYOUT_TABLE: Record<string, HomeLayout> = {
  [roleKey("cekici", "business")]: "tow_focused",
  [roleKey("cekici", "individual")]: "tow_focused",
  [roleKey("usta", "business")]: "full",
  [roleKey("usta", "individual")]: "business_lite",
  [roleKey("kaporta_boya", "business")]: "damage_shop",
  [roleKey("kaporta_boya", "individual")]: "business_lite",
  [roleKey("lastik", "business")]: "business_lite",
  [roleKey("lastik", "individual")]: "minimal",
  [roleKey("oto_elektrik", "business")]: "business_lite",
  [roleKey("oto_elektrik", "individual")]: "minimal",
  [roleKey("oto_aksesuar", "business")]: "business_lite",
  [roleKey("oto_aksesuar", "individual")]: "minimal",
};

export function resolveHomeLayout(
  type: ProviderType,
  mode: ProviderMode,
): HomeLayout {
  return HOME_LAYOUT_TABLE[roleKey(type, mode)] ?? "business_lite";
}

// ───────── quick actions per home_layout ─────────

const QUICK_ACTION_CATALOG: Record<string, QuickAction> = {
  availability: {
    id: "availability",
    label: "Müsaitlik",
    icon: "power",
    route: "/(modal)/musaitlik",
    requires_capability: null,
  },
  active_job: {
    id: "active_job",
    label: "Aktif iş",
    icon: "truck",
    route: "/canli_is",
    requires_capability: "tow",
  },
  pool: {
    id: "pool",
    label: "Havuz",
    icon: "layers",
    route: "/(tabs)/havuz",
    requires_capability: null,
  },
  records: {
    id: "records",
    label: "Kayıtlar",
    icon: "folder",
    route: "/(tabs)/islerim",
    requires_capability: null,
  },
  insurance: {
    id: "insurance",
    label: "Hasar oluştur",
    icon: "shield-check",
    route: "/(modal)/hasar-olustur",
    requires_capability: "insurance_case_handler",
  },
  campaign_create: {
    id: "campaign_create",
    label: "Kampanya oluştur",
    icon: "megaphone",
    route: "/(modal)/kampanya-olustur",
    requires_capability: "campaigns",
  },
  campaigns: {
    id: "campaigns",
    label: "Kampanyalarım",
    icon: "sparkles",
    route: "/(modal)/kampanyalarim",
    requires_capability: "campaigns",
  },
  revenue: {
    id: "revenue",
    label: "Gelir özeti",
    icon: "bar-chart",
    route: "/(modal)/gelir-ozeti",
    requires_capability: null,
  },
  reviews: {
    id: "reviews",
    label: "Yorumlar",
    icon: "message-square",
    route: "/(modal)/yorumlar",
    requires_capability: null,
  },
  certificate: {
    id: "certificate",
    label: "Sertifika yükle",
    icon: "file-check",
    route: "/(modal)/sertifika-yukle",
    requires_capability: null,
  },
  profile: {
    id: "profile",
    label: "Profil",
    icon: "user",
    route: "/(tabs)/profil",
    requires_capability: null,
  },
};

const QUICK_ACTIONS_BY_LAYOUT: Record<HomeLayout, string[]> = {
  tow_focused: ["availability", "active_job", "pool", "revenue", "records"],
  full: [
    "availability",
    "insurance",
    "campaign_create",
    "campaigns",
    "revenue",
    "reviews",
    "records",
    "profile",
  ],
  business_lite: [
    "availability",
    "insurance",
    "revenue",
    "records",
    "reviews",
    "profile",
  ],
  minimal: ["availability", "pool", "records", "profile"],
  damage_shop: [
    "availability",
    "insurance",
    "campaign_create",
    "campaigns",
    "revenue",
    "reviews",
    "records",
  ],
};

export function resolveQuickActionSet(layout: HomeLayout): QuickAction[] {
  const ids = QUICK_ACTIONS_BY_LAYOUT[layout] ?? [];
  return ids
    .map((id) => QUICK_ACTION_CATALOG[id])
    .filter((a): a is QuickAction => Boolean(a));
}

// ───────── required certs per (provider_type, provider_mode) ─────────

const IDENTITY = "identity" as const satisfies TechnicianCertificateKind;
const TAX_REGISTRATION = "tax_registration" as const satisfies TechnicianCertificateKind;
const TRADE_REGISTRY = "trade_registry" as const satisfies TechnicianCertificateKind;
const INSURANCE = "insurance" as const satisfies TechnicianCertificateKind;
const TECHNICAL = "technical" as const satisfies TechnicianCertificateKind;
const VEHICLE_LICENSE = "vehicle_license" as const satisfies TechnicianCertificateKind;
const TOW_OPERATOR = "tow_operator" as const satisfies TechnicianCertificateKind;

const REQUIRED_CERT_TABLE: Record<string, TechnicianCertificateKind[]> = {
  [roleKey("cekici", "business")]: [
    IDENTITY,
    VEHICLE_LICENSE,
    TOW_OPERATOR,
    INSURANCE,
    TAX_REGISTRATION,
    TRADE_REGISTRY,
  ],
  [roleKey("cekici", "individual")]: [
    IDENTITY,
    VEHICLE_LICENSE,
    TOW_OPERATOR,
    INSURANCE,
    TAX_REGISTRATION,
  ],
  [roleKey("usta", "business")]: [IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY],
  [roleKey("usta", "individual")]: [IDENTITY, TAX_REGISTRATION],
  [roleKey("kaporta_boya", "business")]: [
    IDENTITY,
    TAX_REGISTRATION,
    TRADE_REGISTRY,
    INSURANCE,
  ],
  [roleKey("kaporta_boya", "individual")]: [
    IDENTITY,
    TAX_REGISTRATION,
    INSURANCE,
  ],
  [roleKey("lastik", "business")]: [IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY],
  [roleKey("lastik", "individual")]: [IDENTITY, TAX_REGISTRATION],
  [roleKey("oto_elektrik", "business")]: [
    IDENTITY,
    TAX_REGISTRATION,
    TRADE_REGISTRY,
    TECHNICAL,
  ],
  [roleKey("oto_elektrik", "individual")]: [
    IDENTITY,
    TAX_REGISTRATION,
    TECHNICAL,
  ],
  [roleKey("oto_aksesuar", "business")]: [
    IDENTITY,
    TAX_REGISTRATION,
    TRADE_REGISTRY,
  ],
  [roleKey("oto_aksesuar", "individual")]: [IDENTITY, TAX_REGISTRATION],
};

export function resolveRequiredCertKinds(
  type: ProviderType,
  mode: ProviderMode,
): TechnicianCertificateKind[] {
  return REQUIRED_CERT_TABLE[roleKey(type, mode)] ?? [IDENTITY, TAX_REGISTRATION];
}

// ───────── V1 sabit tab set ─────────

export const V1_TAB_SET: string[] = ["home", "havuz", "kayitlar", "profil"];
