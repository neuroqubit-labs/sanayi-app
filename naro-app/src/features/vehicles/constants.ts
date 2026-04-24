/**
 * Vehicle domain enum + label map — backend enum değerleriyle 1:1 paralel.
 *
 * Pure data; icon eşleştirmeleri UI katmanında yapılır (KindStep).
 */

// ---------------------------------------------------------------------------
// Vehicle kind (araç türü) — Adım 1 zorunlu
// ---------------------------------------------------------------------------

export const VEHICLE_KINDS = [
  "otomobil",
  "suv",
  "motosiklet",
  "kamyonet",
  "hafif_ticari",
  "karavan",
  "klasik",
  "ticari",
] as const;

export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export const VEHICLE_KIND_LABELS: Record<VehicleKind, string> = {
  otomobil: "Otomobil",
  suv: "SUV",
  motosiklet: "Motosiklet",
  kamyonet: "Kamyonet",
  hafif_ticari: "Hafif ticari",
  karavan: "Karavan",
  klasik: "Klasik",
  ticari: "Ticari",
};

// ---------------------------------------------------------------------------
// Transmission (vites) — opsiyonel
// ---------------------------------------------------------------------------

export const VEHICLE_TRANSMISSIONS = [
  "manuel",
  "otomatik",
  "yari_otomatik",
] as const;

export type VehicleTransmission = (typeof VEHICLE_TRANSMISSIONS)[number];

export const VEHICLE_TRANSMISSION_LABELS: Record<VehicleTransmission, string> =
  {
    manuel: "Manuel",
    otomatik: "Otomatik",
    yari_otomatik: "Yarı otomatik",
  };

// ---------------------------------------------------------------------------
// Drivetrain (çekiş) — opsiyonel
// ---------------------------------------------------------------------------

export const VEHICLE_DRIVETRAINS = ["fwd", "rwd", "awd", "fourwd"] as const;
export type VehicleDrivetrain = (typeof VEHICLE_DRIVETRAINS)[number];

export const VEHICLE_DRIVETRAIN_LABELS: Record<VehicleDrivetrain, string> = {
  fwd: "Önden çekiş",
  rwd: "Arkadan itiş",
  awd: "Dört tekerlekten çekiş",
  fourwd: "4x4",
};

// ---------------------------------------------------------------------------
// Fuel type (yakıt) — backend enum keys ile eşleşmiş Türkçe label'lar
// ---------------------------------------------------------------------------

export const VEHICLE_FUEL_OPTIONS = [
  { key: "petrol", label: "Benzin" },
  { key: "diesel", label: "Dizel" },
  { key: "lpg", label: "LPG" },
  { key: "electric", label: "Elektrik" },
  { key: "hybrid", label: "Hibrit" },
] as const;

export type VehicleFuelKey = (typeof VEHICLE_FUEL_OPTIONS)[number]["key"];

// ---------------------------------------------------------------------------
// Plate + year constraints
// ---------------------------------------------------------------------------

export const VEHICLE_PLATE_REGEX = /^\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}$/;
export const VEHICLE_YEAR_MIN = 1950;
export const VEHICLE_CHASSIS_MAX_LENGTH = 32;
export const VEHICLE_ENGINE_MAX_LENGTH = 32;
export const VEHICLE_ENGINE_DISPLACEMENT_MAX_LENGTH = 16;
export const VEHICLE_ENGINE_POWER_MAX_HP = 2000;

// ---------------------------------------------------------------------------
// Popular makes (Türkiye pazarı) — logolu slider için isim + domain.
// Logo URL'si: https://logo.clearbit.com/{domain} (ücretsiz CDN; yüklenmezse
// baş harf avatarı fallback).
// ---------------------------------------------------------------------------

export type VehicleMakeOption = {
  name: string;
  domain: string;
};

export const VEHICLE_POPULAR_MAKES: readonly VehicleMakeOption[] = [
  { name: "Renault", domain: "renault.com" },
  { name: "Fiat", domain: "fiat.com" },
  { name: "Volkswagen", domain: "volkswagen.com" },
  { name: "Ford", domain: "ford.com" },
  { name: "Hyundai", domain: "hyundai.com" },
  { name: "Toyota", domain: "toyota.com" },
  { name: "Opel", domain: "opel.com" },
  { name: "Peugeot", domain: "peugeot.com" },
  { name: "Dacia", domain: "dacia.com" },
  { name: "Mercedes-Benz", domain: "mercedes-benz.com" },
  { name: "BMW", domain: "bmw.com" },
  { name: "Audi", domain: "audi.com" },
  { name: "Honda", domain: "honda.com" },
  { name: "Kia", domain: "kia.com" },
  { name: "Citroen", domain: "citroen.com" },
  { name: "Skoda", domain: "skoda-auto.com" },
  { name: "Seat", domain: "seat.com" },
  { name: "Nissan", domain: "nissan.com" },
  { name: "Tofaş", domain: "tofas.com.tr" },
  { name: "Mitsubishi", domain: "mitsubishi-motors.com" },
] as const;

export function getMakeLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}
