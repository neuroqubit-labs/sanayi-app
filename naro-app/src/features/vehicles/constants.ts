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
