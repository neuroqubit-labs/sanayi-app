import { z } from "zod";

export const DrivetrainSchema = z.enum([
  "benzin_otomatik",
  "benzin_manuel",
  "dizel_otomatik",
  "dizel_manuel",
  "hibrit",
  "ev",
  "lpg_donusumlu",
  "cng_donusumlu",
  "motosiklet",
]);
export type Drivetrain = z.infer<typeof DrivetrainSchema>;

export type DrivetrainMeta = {
  key: Drivetrain;
  label: string;
  fuel: "benzin" | "dizel" | "hibrit" | "ev" | "lpg" | "cng" | "moto";
  transmission?: "otomatik" | "manuel" | "dsg" | "cvt" | "moto";
  order: number;
};

export const DRIVETRAIN_META: Record<Drivetrain, DrivetrainMeta> = {
  benzin_otomatik: {
    key: "benzin_otomatik",
    label: "Benzin · Otomatik",
    fuel: "benzin",
    transmission: "otomatik",
    order: 1,
  },
  benzin_manuel: {
    key: "benzin_manuel",
    label: "Benzin · Manuel",
    fuel: "benzin",
    transmission: "manuel",
    order: 2,
  },
  dizel_otomatik: {
    key: "dizel_otomatik",
    label: "Dizel · Otomatik",
    fuel: "dizel",
    transmission: "otomatik",
    order: 3,
  },
  dizel_manuel: {
    key: "dizel_manuel",
    label: "Dizel · Manuel",
    fuel: "dizel",
    transmission: "manuel",
    order: 4,
  },
  hibrit: { key: "hibrit", label: "Hibrit", fuel: "hibrit", order: 5 },
  ev: { key: "ev", label: "Elektrikli (EV)", fuel: "ev", order: 6 },
  lpg_donusumlu: {
    key: "lpg_donusumlu",
    label: "LPG dönüşümlü",
    fuel: "lpg",
    order: 7,
  },
  cng_donusumlu: {
    key: "cng_donusumlu",
    label: "CNG dönüşümlü",
    fuel: "cng",
    order: 8,
  },
  motosiklet: {
    key: "motosiklet",
    label: "Motosiklet",
    fuel: "moto",
    transmission: "moto",
    order: 9,
  },
};

export const DRIVETRAIN_ORDER: Drivetrain[] = [
  "benzin_otomatik",
  "benzin_manuel",
  "dizel_otomatik",
  "dizel_manuel",
  "hibrit",
  "ev",
  "lpg_donusumlu",
  "cng_donusumlu",
  "motosiklet",
];
