import type { ProviderType } from "@naro/domain";
import type { StatusChipTone } from "@naro/ui";

import type { TechnicianProfileState } from "@/features/technicians";

export type ServiceQuickActionKey =
  | "availability"
  | "insurance"
  | "pool"
  | "records"
  | "campaign_create"
  | "campaigns"
  | "revenue"
  | "profile";

export type TechnicianQuickActionModeKey =
  | "towing"
  | "full_service"
  | "insurance"
  | "mobile"
  | "workshop"
  | "accessory"
  | "bodyshop"
  | "tire"
  | "electric";

export type TechnicianQuickActionMode = {
  key: TechnicianQuickActionModeKey;
  title: string;
  description: string;
  eyebrow: string;
  primary: ServiceQuickActionKey[];
  secondary: ServiceQuickActionKey[];
};

export type TechnicianQuickActionTag = {
  label: string;
  tone: StatusChipTone;
};

const TOWING_RE = /cekici|çekici|yol yardim|yol yardım|kurtarma|transfer/i;
const INSURANCE_RE = /hasar|kaporta|boya|sigorta|kasko|ekspertiz|dosya/i;
const MOBILE_RE = /mobil|yerinde|bakim|bakım|periyodik|aku|akü|lastik|klima/i;

const PROVIDER_MODE: Record<ProviderType, TechnicianQuickActionMode> = {
  cekici: {
    key: "towing",
    title: "Yol yardım akışları",
    description:
      "Transfer, yönlendirme ve hızlı kabul odaklı kısa yollar öne çıkarıldı.",
    eyebrow: "Çekici odaklı",
    primary: ["availability", "pool", "records"],
    secondary: ["revenue", "profile"],
  },
  oto_aksesuar: {
    key: "accessory",
    title: "Aksesuar & montaj kısa yolları",
    description:
      "Paket ve randevu ağırlıklı çalışırsın; kampanya yerine paket vitrinin aktif.",
    eyebrow: "Aksesuar uzmanı",
    primary: ["availability", "pool", "records"],
    secondary: ["revenue", "profile"],
  },
  kaporta_boya: {
    key: "bodyshop",
    title: "Kaporta & boya akışları",
    description:
      "Hasar dosyaları + kampanya + operasyon bir arada. Sigorta akışı öncelikli.",
    eyebrow: "Kaporta uzmanı",
    primary: ["availability", "insurance", "campaign_create"],
    secondary: ["records", "revenue", "campaigns"],
  },
  lastik: {
    key: "tire",
    title: "Lastik & rot balans kısa yolları",
    description:
      "Sezonluk kampanya + günlük iş akışı + havuz taramaları öne alındı.",
    eyebrow: "Lastik uzmanı",
    primary: ["availability", "campaign_create", "pool"],
    secondary: ["records", "campaigns", "revenue"],
  },
  oto_elektrik: {
    key: "electric",
    title: "Oto elektrik akışları",
    description:
      "Teşhis, ECU ve elektronik odaklı operasyon kısa yolları.",
    eyebrow: "Oto elektrik uzmanı",
    primary: ["availability", "pool", "campaign_create"],
    secondary: ["records", "revenue", "profile"],
  },
  usta: {
    key: "workshop",
    title: "Atölye kısa yolları",
    description:
      "Günlük iş akışını sadeleştiren operasyon, kayıt ve görünürlük araçları.",
    eyebrow: "Atölye akışı",
    primary: ["availability", "records", "pool"],
    secondary: ["campaign_create", "revenue", "profile"],
  },
};

export function resolveTechnicianQuickActionMode(
  profile: TechnicianProfileState,
): TechnicianQuickActionMode {
  // provider_type öncelikli; usta için regex-based detail'li çözümleme yapılır.
  if (profile.provider_type !== "usta") {
    return PROVIDER_MODE[profile.provider_type];
  }

  const text = [
    profile.tagline,
    profile.biography,
    ...profile.specialties,
    ...profile.expertise,
  ]
    .filter(Boolean)
    .join(" ");

  const hasTowing =
    profile.capabilities.towing_coordination || TOWING_RE.test(text);
  const hasInsurance =
    profile.capabilities.insurance_case_handler || INSURANCE_RE.test(text);
  const hasMobile =
    profile.capabilities.on_site_repair ||
    profile.capabilities.valet_service ||
    MOBILE_RE.test(text);
  const capabilityCount = Object.values(profile.capabilities).filter(
    Boolean,
  ).length;

  if (hasTowing && !hasInsurance && !hasMobile && capabilityCount <= 1) {
    return {
      key: "towing",
      title: "Yol yardım akışları",
      description:
        "Transfer, yönlendirme ve hızlı kabul odaklı kısa yollar öne çıkarıldı.",
      eyebrow: "Çekici odaklı",
      primary: ["availability", "pool", "records"],
      secondary: ["revenue", "profile"],
    };
  }

  if (hasInsurance && capabilityCount >= 2) {
    return {
      key: "full_service",
      title: "Servis merkezi kısayolları",
      description:
        "Hasar, kampanya ve günlük operasyonu tek sheet içinde topladık.",
      eyebrow: "Kapsamlı servis",
      primary: ["availability", "insurance", "campaign_create"],
      secondary: ["revenue", "campaigns", "records"],
    };
  }

  if (hasInsurance) {
    return {
      key: "insurance",
      title: "Hasar ve dosya akışları",
      description:
        "Sigorta dosyası ve teslim operasyonları için sade bir giriş yüzeyi.",
      eyebrow: "Hasar uzmanı",
      primary: ["availability", "insurance", "records"],
      secondary: ["revenue", "campaigns", "pool"],
    };
  }

  if (hasMobile) {
    return {
      key: "mobile",
      title: "Mobil servis akışları",
      description:
        "Saha işi alan, hızlı teklif ve günlük operasyon akışları öne alındı.",
      eyebrow: "Mobil bakım",
      primary: ["availability", "pool", "campaign_create"],
      secondary: ["records", "revenue", "profile"],
    };
  }

  return PROVIDER_MODE.usta;
}

export function buildTechnicianQuickActionTags(
  profile: TechnicianProfileState,
): TechnicianQuickActionTag[] {
  const tags: TechnicianQuickActionTag[] = [];

  if (profile.capabilities.insurance_case_handler) {
    tags.push({ label: "Hasar dosyası", tone: "info" });
  }
  if (profile.capabilities.on_site_repair) {
    tags.push({ label: "Yerinde servis", tone: "accent" });
  }
  if (profile.capabilities.towing_coordination) {
    tags.push({ label: "Çekici akışı", tone: "warning" });
  }
  if (profile.capabilities.valet_service) {
    tags.push({ label: "Pickup / vale", tone: "success" });
  }

  profile.specialties.slice(0, 2).forEach((specialty) => {
    tags.push({ label: specialty, tone: "neutral" });
  });

  return tags.slice(0, 4);
}
