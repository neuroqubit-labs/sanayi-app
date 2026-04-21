import type { MaintenanceCategory, ServiceRequestDraft } from "@naro/domain";
import {
  Battery,
  Car,
  CircleSlash,
  CloudSnow,
  Droplets,
  Flame,
  Gauge,
  Package,
  Receipt,
  Snowflake,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react-native";

import type { BreakdownQuestion } from "../components/questionFields/types";

import type { EvidenceStep } from "./evidenceSteps";

export type MaintenanceCategoryMeta = {
  id: MaintenanceCategory;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

export type MaintenanceTemplate = {
  category: MaintenanceCategory;
  hero: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
  };
  questions: BreakdownQuestion[];
  evidence: EvidenceStep[];
  priceRange: [number, number];
  tierKey?: string;
};

export const MAINTENANCE_PACKAGE_CATEGORIES: MaintenanceCategoryMeta[] = [
  {
    id: "package_summer",
    title: "Yazlık Paket",
    subtitle: "Klima · cam filmi · yaz lastiği",
    icon: Sun,
  },
  {
    id: "package_winter",
    title: "Kışlık Paket",
    subtitle: "Akü · antifriz · kış lastiği",
    icon: CloudSnow,
  },
  {
    id: "package_new_car",
    title: "Yeni Araç Paketi",
    subtitle: "Seramik · cam filmi · PPF",
    icon: Package,
  },
  {
    id: "package_sale_prep",
    title: "Satış Öncesi Hazırlık",
    subtitle: "Detaylı yıkama · far · rötuş",
    icon: Receipt,
  },
];

export const MAINTENANCE_SINGLE_CATEGORIES: MaintenanceCategoryMeta[] = [
  {
    id: "periodic",
    title: "Periyodik bakım",
    subtitle: "Yağ, filtre, genel kontrol",
    icon: Gauge,
  },
  {
    id: "tire",
    title: "Lastik değişimi",
    subtitle: "Mevsim + marka + jant",
    icon: Car,
  },
  {
    id: "glass_film",
    title: "Cam filmi",
    subtitle: "Yan / ön / tam kapsam",
    icon: Sun,
  },
  {
    id: "coating",
    title: "Seramik / PPF",
    subtitle: "Koruma + parlaklık",
    icon: Sparkles,
  },
  {
    id: "battery",
    title: "Akü değişimi",
    subtitle: "Kapasite + marka tercihi",
    icon: Battery,
  },
  {
    id: "climate",
    title: "Klima bakımı",
    subtitle: "Gaz şarjı, filtre, kontrol",
    icon: Snowflake,
  },
  {
    id: "brake",
    title: "Fren balata",
    subtitle: "Ön / arka / takım",
    icon: CircleSlash,
  },
  {
    id: "detail_wash",
    title: "Detaylı yıkama",
    subtitle: "İç, dış, tam detay",
    icon: Droplets,
  },
  {
    id: "headlight_polish",
    title: "Far polisaj",
    subtitle: "Matlaşmış far düzeltme",
    icon: Sun,
  },
  {
    id: "engine_wash",
    title: "Motor yıkama",
    subtitle: "Temizlik + koruma spreyi",
    icon: Flame,
  },
];

export const MAINTENANCE_CATEGORIES: MaintenanceCategoryMeta[] = [
  ...MAINTENANCE_PACKAGE_CATEGORIES,
  ...MAINTENANCE_SINGLE_CATEGORIES,
];

export const MAINTENANCE_CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  periodic: "Periyodik bakım",
  tire: "Lastik değişimi",
  glass_film: "Cam filmi",
  coating: "Seramik / PPF",
  battery: "Akü değişimi",
  climate: "Klima bakımı",
  brake: "Fren balata",
  detail_wash: "Detaylı yıkama",
  headlight_polish: "Far polisaj",
  engine_wash: "Motor yıkama",
  package_summer: "Yazlık Paket",
  package_winter: "Kışlık Paket",
  package_new_car: "Yeni Araç Paketi",
  package_sale_prep: "Satış Öncesi Hazırlık",
};

const PERIODIC_TEMPLATE: MaintenanceTemplate = {
  category: "periodic",
  hero: {
    icon: Gauge,
    title: "Periyodik bakım planla",
    subtitle:
      "Aracının kilometresine ve parça tercihine göre paket taslağını çıkaralım.",
  },
  questions: [
    {
      kind: "chips",
      id: "periodic_km",
      title: "Hangi bakım aralığı?",
      multi: false,
      options: [
        "10.000 km",
        "20.000 km",
        "40.000 km",
        "60.000 km",
        "80.000 km",
        "100.000 km",
      ],
    },
    {
      kind: "chips",
      id: "periodic_tier",
      title: "Parça tercihi",
      multi: false,
      options: [
        "Ekonomik (muadil)",
        "Standart (karma)",
        "Premium (orijinal)",
      ],
    },
    {
      kind: "chips",
      id: "periodic_extras",
      title: "Ek kalemler (opsiyonel)",
      options: ["Buji", "Triger kayışı", "Klima filtresi", "Yakıt filtresi"],
    },
  ],
  evidence: [
    {
      id: "mileage_photo",
      title: "Kilometre fotoğrafı",
      hint: "Gösterge panelinden güncel kilometreyi paylaş.",
      kinds: ["photo"],
      maxPhotos: 1,
      required: true,
    },
    {
      id: "service_record",
      title: "Eski servis formu (opsiyonel)",
      hint: "Geçmiş bakım dokümanı varsa hizmet ağı hızlanır.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  priceRange: [700, 1800],
  tierKey: "periodic_tier",
};

const TIRE_TEMPLATE: MaintenanceTemplate = {
  category: "tire",
  hero: {
    icon: Car,
    title: "Lastik değişimi",
    subtitle:
      "Mevsim, marka tier ve jant boyu → servis tekliflerini netleştirir.",
  },
  questions: [
    {
      kind: "chips",
      id: "tire_season",
      title: "Hangi lastik?",
      multi: false,
      options: ["Yaz", "Kış", "4 mevsim"],
    },
    {
      kind: "chips",
      id: "tire_tier",
      title: "Marka tercihi",
      multi: false,
      options: [
        "Bütçe (Sailun, Westlake)",
        "Orta (Hankook, Goodride)",
        "Premium (Michelin, Continental)",
      ],
    },
    {
      kind: "short_text",
      id: "tire_size",
      title: "Jant / lastik ölçüsü",
      placeholder: "Örn: 205/55 R16",
    },
    {
      kind: "chips",
      id: "tire_count",
      title: "Kaç lastik?",
      multi: false,
      options: ["2", "4"],
    },
    {
      kind: "chips",
      id: "tire_extras",
      title: "Yanında istenenler (opsiyonel)",
      options: ["Balans", "Rotasyon", "Rot-balans", "Eski lastik geri alım"],
    },
  ],
  evidence: [
    {
      id: "tire_current",
      title: "Mevcut lastiklerin genel fotoğrafı",
      hint: "4 lastiği gösteren kare — diş aşınma tahminine yarar.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
    {
      id: "tire_wear",
      title: "Aşınma yakın çekim (opsiyonel)",
      hint: "En aşınmış lastiğin yüzeyi.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  priceRange: [800, 4500],
  tierKey: "tire_tier",
};

const GLASS_FILM_TEMPLATE: MaintenanceTemplate = {
  category: "glass_film",
  hero: {
    icon: Sun,
    title: "Cam filmi",
    subtitle: "Kapsam ve geçirgenlik tercihini işaretle; tekliflere yansıyor.",
  },
  questions: [
    {
      kind: "chips",
      id: "film_coverage",
      title: "Kapsam",
      multi: false,
      options: ["Sadece yan camlar", "Ön cam dahil", "Tam (panorama dahil)"],
    },
    {
      kind: "chips",
      id: "film_tone",
      title: "Geçirgenlik",
      multi: false,
      options: ["%50", "%35", "%15", "%5 (koyu)"],
    },
    {
      kind: "chips",
      id: "film_tier",
      title: "Kalite",
      multi: false,
      options: ["Standart", "Premium (seramik)"],
    },
  ],
  evidence: [
    {
      id: "glass_current",
      title: "Camların genel görünümü",
      hint: "Mevcut cam durumu (varsa eski film).",
      kinds: ["photo"],
      maxPhotos: 2,
    },
    {
      id: "glass_reference",
      title: "Referans / istek (opsiyonel)",
      hint: "Beğendiğin bir örnek görsel varsa paylaş.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  priceRange: [1200, 3500],
  tierKey: "film_tier",
};

const COATING_TEMPLATE: MaintenanceTemplate = {
  category: "coating",
  hero: {
    icon: Sparkles,
    title: "Seramik / PPF kaplama",
    subtitle: "Tip + süre + kapsam — usta fiyat bandını buna göre hesaplar.",
  },
  questions: [
    {
      kind: "chips",
      id: "coat_type",
      title: "Tür",
      multi: false,
      options: ["Seramik kaplama", "PPF (şeffaf film)"],
    },
    {
      kind: "chips",
      id: "coat_duration",
      title: "Süre garantisi",
      multi: false,
      options: ["1 yıl", "3 yıl", "5 yıl"],
    },
    {
      kind: "chips",
      id: "coat_scope",
      title: "Kapsam",
      multi: false,
      options: [
        "Sadece ön panel",
        "Motor kapuak + çamurluklar",
        "Tam araç",
      ],
    },
  ],
  evidence: [
    {
      id: "coat_body",
      title: "Aracın dış gövdesi",
      hint: "2-3 açıdan genel kare.",
      kinds: ["photo"],
      maxPhotos: 3,
    },
  ],
  priceRange: [2500, 8000],
  tierKey: "coat_duration",
};

const BATTERY_TEMPLATE: MaintenanceTemplate = {
  category: "battery",
  hero: {
    icon: Battery,
    title: "Akü değişimi",
    subtitle: "Kapasite ve marka tercihine göre yerinde değişim mümkün.",
  },
  questions: [
    {
      kind: "chips",
      id: "battery_cap",
      title: "Kapasite (Ah)",
      multi: false,
      options: ["45", "55", "70", "90", "Bilmiyorum"],
    },
    {
      kind: "chips",
      id: "battery_tier",
      title: "Marka tercihi",
      multi: false,
      options: ["Muadil", "Orijinal (Varta / Mutlu)"],
    },
  ],
  evidence: [
    {
      id: "battery_existing",
      title: "Mevcut akü etiketi",
      hint: "Aküdeki etiket fotoğrafı — doğru kapasite için.",
      kinds: ["photo"],
      maxPhotos: 1,
      required: true,
    },
  ],
  priceRange: [1800, 3500],
  tierKey: "battery_tier",
};

const CLIMATE_TEMPLATE: MaintenanceTemplate = {
  category: "climate",
  hero: {
    icon: Snowflake,
    title: "Klima bakımı",
    subtitle: "Gaz şarjı, filtre ve kontrol kombinasyonunu seç.",
  },
  questions: [
    {
      kind: "chips",
      id: "climate_scope",
      title: "Kapsam (birden fazla seçebilirsin)",
      options: [
        "Gaz şarjı",
        "Kabin filtresi değişimi",
        "Kompresör kontrolü",
        "Bakteri / koku temizliği",
      ],
    },
  ],
  evidence: [
    {
      id: "climate_dashboard",
      title: "Gösterge paneli",
      hint: "Klima ayar panelinin fotoğrafı.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
    {
      id: "climate_cabin",
      title: "Kabin içi (opsiyonel)",
      hint: "Hava çıkış ızgaraları görünür olsun.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
  ],
  priceRange: [600, 1400],
};

const BRAKE_TEMPLATE: MaintenanceTemplate = {
  category: "brake",
  hero: {
    icon: CircleSlash,
    title: "Fren balata değişimi",
    subtitle: "Bölge + parça tier — güvenlik odaklı bir iş.",
  },
  questions: [
    {
      kind: "chips",
      id: "brake_area",
      title: "Bölge",
      options: ["Ön", "Arka", "Disk dahil"],
    },
    {
      kind: "chips",
      id: "brake_tier",
      title: "Parça tier",
      multi: false,
      options: ["Ekonomik", "Standart", "Premium (performans)"],
    },
  ],
  evidence: [
    {
      id: "brake_wheel",
      title: "Tekerlek / balata görünümü (opsiyonel)",
      hint: "Mümkünse mevcut balatanın görüldüğü açı.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  priceRange: [900, 2400],
  tierKey: "brake_tier",
};

const DETAIL_WASH_TEMPLATE: MaintenanceTemplate = {
  category: "detail_wash",
  hero: {
    icon: Droplets,
    title: "Detaylı yıkama",
    subtitle: "İç / dış / tam detay kapsamı seç.",
  },
  questions: [
    {
      kind: "chips",
      id: "wash_scope",
      title: "Paket",
      multi: false,
      options: ["Dış yıkama", "İç detay", "Tam paket (iç + dış)"],
    },
    {
      kind: "chips",
      id: "wash_tier",
      title: "Seviye",
      multi: false,
      options: ["Standart", "Premium (cilalama dahil)"],
    },
    {
      kind: "chips",
      id: "wash_extras",
      title: "Ek isterler (opsiyonel)",
      options: ["Motor yıkama", "Koltuk şampuanlama", "Bagaj detay"],
    },
  ],
  evidence: [
    {
      id: "wash_current",
      title: "Aracın mevcut durumu (opsiyonel)",
      hint: "Özellikle kirlilik / leke alanları görünsün.",
      kinds: ["photo"],
      maxPhotos: 3,
    },
  ],
  priceRange: [300, 900],
  tierKey: "wash_tier",
};

const HEADLIGHT_TEMPLATE: MaintenanceTemplate = {
  category: "headlight_polish",
  hero: {
    icon: Sun,
    title: "Far polisaj",
    subtitle: "Matlaşmış farları yenile — 1 saatte biten bir iş.",
  },
  questions: [
    {
      kind: "chips",
      id: "headlight_count",
      title: "Kaç far?",
      multi: false,
      options: ["1 far", "2 far"],
    },
    {
      kind: "chips",
      id: "headlight_condition",
      title: "Durumu",
      multi: false,
      options: ["Hafif matlaşma", "Belirgin sararma", "Yoğun hasar"],
    },
  ],
  evidence: [
    {
      id: "headlight_photo",
      title: "Far yakın çekim",
      hint: "Matlaşma / sararma net görünsün.",
      kinds: ["photo"],
      maxPhotos: 2,
      required: true,
    },
  ],
  priceRange: [350, 700],
};

const ENGINE_WASH_TEMPLATE: MaintenanceTemplate = {
  category: "engine_wash",
  hero: {
    icon: Flame,
    title: "Motor yıkama",
    subtitle: "Temizlik + koruma spreyi — periyodik bakım öncesi önerilir.",
  },
  questions: [
    {
      kind: "chips",
      id: "engine_scope",
      title: "Paket",
      multi: false,
      options: ["Sadece yıkama", "Yıkama + koruma spreyi"],
    },
  ],
  evidence: [
    {
      id: "engine_bay",
      title: "Motor bölmesi (opsiyonel)",
      hint: "Kaputu aç, motor genel görünümü.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
  ],
  priceRange: [250, 550],
};

const PACKAGE_SUMMER_TEMPLATE: MaintenanceTemplate = {
  category: "package_summer",
  hero: {
    icon: Sun,
    title: "Yazlık Paket",
    subtitle:
      "Yaz sezonu öncesi öne çıkan işleri tek talepte toparla. İstemediklerini çıkart.",
  },
  questions: [
    {
      kind: "chips",
      id: "summer_items",
      title: "Pakete dahil işler",
      options: [
        "Klima gaz şarjı + filtre",
        "Yaz lastiği değişimi",
        "Ön cam filmi (ısı kontrolü)",
        "Far polisaj",
        "Motor yıkama + koruma",
        "Dış detaylı yıkama",
      ],
    },
    {
      kind: "chips",
      id: "summer_tier",
      title: "Paket seviyesi",
      multi: false,
      options: ["Ekonomik", "Standart", "Premium"],
    },
  ],
  evidence: [
    {
      id: "summer_vehicle",
      title: "Aracın genel görünümü",
      hint: "Dış panoramik bir kare, pakete uygunluk için.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
    {
      id: "summer_dashboard",
      title: "Kilometre fotoğrafı (opsiyonel)",
      hint: "Yaz bakım takvimi için km.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
  ],
  priceRange: [2000, 6000],
  tierKey: "summer_tier",
};

const PACKAGE_WINTER_TEMPLATE: MaintenanceTemplate = {
  category: "package_winter",
  hero: {
    icon: CloudSnow,
    title: "Kışlık Paket",
    subtitle:
      "Kış sezonuna tek seferde hazırlan. Akü, antifriz, lastik ve fren kontrolü.",
  },
  questions: [
    {
      kind: "chips",
      id: "winter_items",
      title: "Pakete dahil işler",
      options: [
        "Akü sağlık testi",
        "Kış lastiği değişimi",
        "Antifriz + soğutma sistemi",
        "Silecek takımı",
        "Fren balata + hidrolik kontrol",
        "Cam buğu çözücü",
      ],
    },
    {
      kind: "chips",
      id: "winter_tier",
      title: "Paket seviyesi",
      multi: false,
      options: ["Ekonomik", "Standart", "Premium"],
    },
  ],
  evidence: [
    {
      id: "winter_tires",
      title: "Mevcut lastiklerin fotoğrafı",
      hint: "Kış lastiği değişimi için referans.",
      kinds: ["photo"],
      maxPhotos: 2,
    },
    {
      id: "winter_battery",
      title: "Akü etiketi (opsiyonel)",
      hint: "Doğru kapasite için akü etiketi.",
      kinds: ["photo"],
      maxPhotos: 1,
    },
  ],
  priceRange: [2500, 7500],
  tierKey: "winter_tier",
};

const PACKAGE_NEW_CAR_TEMPLATE: MaintenanceTemplate = {
  category: "package_new_car",
  hero: {
    icon: Package,
    title: "Yeni Araç Paketi",
    subtitle:
      "Sıfır ya da yakın zamanda aldığın araç için koruma + konfor paketi.",
  },
  questions: [
    {
      kind: "chips",
      id: "new_items",
      title: "Pakete dahil işler",
      options: [
        "Seramik kaplama (3 yıl)",
        "Ön cam filmi",
        "Ön panel PPF",
        "Detaylı iç temizlik",
        "Kapı eşik koruma filmi",
        "Koltuk koruyucu sprey",
      ],
    },
    {
      kind: "chips",
      id: "new_tier",
      title: "Koruma seviyesi",
      multi: false,
      options: ["Temel", "Kapsamlı", "Tam koruma"],
    },
  ],
  evidence: [
    {
      id: "new_vehicle",
      title: "Aracın dış görünümü",
      hint: "2-3 açıdan genel kare (sol/sağ/ön-arka).",
      kinds: ["photo"],
      maxPhotos: 4,
      required: true,
    },
  ],
  priceRange: [5000, 18000],
  tierKey: "new_tier",
};

const PACKAGE_SALE_PREP_TEMPLATE: MaintenanceTemplate = {
  category: "package_sale_prep",
  hero: {
    icon: Receipt,
    title: "Satış Öncesi Hazırlık",
    subtitle:
      "Aracını satışa çıkarmadan önce değerini artıracak detay paketi.",
  },
  questions: [
    {
      kind: "chips",
      id: "sale_items",
      title: "Pakete dahil işler",
      options: [
        "Detaylı iç + dış yıkama",
        "Far polisaj",
        "Motor yıkama + koruma",
        "Ufak rötuş (far/tampon)",
        "İç döşeme şampuanlama",
        "Seramik pasta",
      ],
    },
    {
      kind: "chips",
      id: "sale_tier",
      title: "Seviye",
      multi: false,
      options: ["Standart", "Premium"],
    },
  ],
  evidence: [
    {
      id: "sale_vehicle",
      title: "Aracın mevcut hali",
      hint: "Özellikle dikkat çekmesini istediğin noktalar.",
      kinds: ["photo"],
      maxPhotos: 4,
    },
  ],
  priceRange: [800, 3500],
  tierKey: "sale_tier",
};

export const MAINTENANCE_TEMPLATES: Record<
  MaintenanceCategory,
  MaintenanceTemplate
> = {
  periodic: PERIODIC_TEMPLATE,
  tire: TIRE_TEMPLATE,
  glass_film: GLASS_FILM_TEMPLATE,
  coating: COATING_TEMPLATE,
  battery: BATTERY_TEMPLATE,
  climate: CLIMATE_TEMPLATE,
  brake: BRAKE_TEMPLATE,
  detail_wash: DETAIL_WASH_TEMPLATE,
  headlight_polish: HEADLIGHT_TEMPLATE,
  engine_wash: ENGINE_WASH_TEMPLATE,
  package_summer: PACKAGE_SUMMER_TEMPLATE,
  package_winter: PACKAGE_WINTER_TEMPLATE,
  package_new_car: PACKAGE_NEW_CAR_TEMPLATE,
  package_sale_prep: PACKAGE_SALE_PREP_TEMPLATE,
};

const TIER_MULTIPLIER: Record<string, number> = {
  "Ekonomik (muadil)": 0.85,
  "Standart (karma)": 1.0,
  "Premium (orijinal)": 1.25,
  "Bütçe (Sailun, Westlake)": 0.7,
  "Orta (Hankook, Goodride)": 1.0,
  "Premium (Michelin, Continental)": 1.6,
  Standart: 1.0,
  "Premium (seramik)": 1.35,
  Muadil: 0.8,
  "Orijinal (Varta / Mutlu)": 1.2,
  Ekonomik: 0.85,
  Premium: 1.3,
  "Premium (performans)": 1.35,
  "Premium (cilalama dahil)": 1.4,
  "1 yıl": 0.7,
  "3 yıl": 1.0,
  "5 yıl": 1.45,
  Temel: 0.7,
  Kapsamlı: 1.15,
  "Tam koruma": 1.55,
};

function resolveTierMultiplier(
  template: MaintenanceTemplate,
  draft: ServiceRequestDraft,
): number {
  if (!template.tierKey) return 1;
  const prefix = `${template.tierKey}:`;
  const picked = draft.maintenance_items.find((entry) =>
    entry.startsWith(prefix),
  );
  if (!picked) return 1;
  const value = picked.slice(prefix.length);
  return TIER_MULTIPLIER[value] ?? 1;
}

function scopeAdjustment(draft: ServiceRequestDraft): number {
  // Coating scope: ön panel < yarı < tam araç
  const coatScope = draft.maintenance_items.find((entry) =>
    entry.startsWith("coat_scope:"),
  );
  if (coatScope?.endsWith("Sadece ön panel")) return 0.45;
  if (coatScope?.endsWith("Motor kapuak + çamurluklar")) return 0.75;
  if (coatScope?.endsWith("Tam araç")) return 1.3;

  // Tire count
  const tireCount = draft.maintenance_items.find((entry) =>
    entry.startsWith("tire_count:"),
  );
  if (tireCount?.endsWith("2")) return 0.55;
  if (tireCount?.endsWith("4")) return 1.0;

  // Brake area
  const brakeAreas = draft.maintenance_items.filter((entry) =>
    entry.startsWith("brake_area:"),
  );
  if (brakeAreas.length === 1) return 0.65;
  if (brakeAreas.length >= 2) return 1.1;

  // Headlight count
  const headCount = draft.maintenance_items.find((entry) =>
    entry.startsWith("headlight_count:"),
  );
  if (headCount?.endsWith("1 far")) return 0.6;

  return 1;
}

function formatPrice(value: number): string {
  return `₺${Math.round(value / 10) * 10}`;
}

export function estimatePriceRange(draft: ServiceRequestDraft): {
  label: string;
  min: number;
  max: number;
} | null {
  const category = draft.maintenance_category;
  if (!category) return null;
  const template = MAINTENANCE_TEMPLATES[category];
  const tier = resolveTierMultiplier(template, draft);
  const scope = scopeAdjustment(draft);
  const factor = tier * scope;
  const [baseMin, baseMax] = template.priceRange;
  const min = baseMin * factor;
  const max = baseMax * factor;

  return {
    label: `${formatPrice(min)} – ${formatPrice(max)}`,
    min,
    max,
  };
}
