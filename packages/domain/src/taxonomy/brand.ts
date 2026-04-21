import { z } from "zod";

export const BrandTierSchema = z.enum([
  "mass",
  "premium",
  "luxury",
  "commercial",
  "motorcycle",
]);
export type BrandTier = z.infer<typeof BrandTierSchema>;

export type BrandMeta = {
  key: string;
  label: string;
  tier: BrandTier;
  country?: string;
  order: number;
};

export const BRAND_CATALOG: BrandMeta[] = [
  // TR + commercial
  { key: "tofas_fiat", label: "TOFAŞ / Fiat", tier: "mass", country: "TR", order: 1 },
  { key: "renault", label: "Renault", tier: "mass", country: "FR", order: 2 },
  { key: "dacia", label: "Dacia", tier: "mass", country: "RO", order: 3 },
  { key: "ford", label: "Ford", tier: "mass", country: "US", order: 4 },
  { key: "ford_tourneo", label: "Ford Transit / Tourneo", tier: "commercial", country: "US", order: 5 },
  { key: "peugeot", label: "Peugeot", tier: "mass", country: "FR", order: 6 },
  { key: "citroen", label: "Citroën", tier: "mass", country: "FR", order: 7 },
  { key: "opel", label: "Opel", tier: "mass", country: "DE", order: 8 },

  // volume
  { key: "volkswagen", label: "Volkswagen", tier: "mass", country: "DE", order: 10 },
  { key: "skoda", label: "Škoda", tier: "mass", country: "CZ", order: 11 },
  { key: "seat", label: "Seat", tier: "mass", country: "ES", order: 12 },
  { key: "hyundai", label: "Hyundai", tier: "mass", country: "KR", order: 13 },
  { key: "kia", label: "Kia", tier: "mass", country: "KR", order: 14 },
  { key: "toyota", label: "Toyota", tier: "mass", country: "JP", order: 15 },
  { key: "honda", label: "Honda", tier: "mass", country: "JP", order: 16 },
  { key: "nissan", label: "Nissan", tier: "mass", country: "JP", order: 17 },
  { key: "mazda", label: "Mazda", tier: "mass", country: "JP", order: 18 },
  { key: "suzuki", label: "Suzuki", tier: "mass", country: "JP", order: 19 },
  { key: "mitsubishi", label: "Mitsubishi", tier: "mass", country: "JP", order: 20 },
  { key: "chevrolet", label: "Chevrolet", tier: "mass", country: "US", order: 21 },

  // premium
  { key: "bmw", label: "BMW", tier: "premium", country: "DE", order: 30 },
  { key: "mercedes", label: "Mercedes-Benz", tier: "premium", country: "DE", order: 31 },
  { key: "audi", label: "Audi", tier: "premium", country: "DE", order: 32 },
  { key: "volvo", label: "Volvo", tier: "premium", country: "SE", order: 33 },
  { key: "mini", label: "Mini", tier: "premium", country: "GB", order: 34 },
  { key: "lexus", label: "Lexus", tier: "premium", country: "JP", order: 35 },
  { key: "infiniti", label: "Infiniti", tier: "premium", country: "JP", order: 36 },
  { key: "alfa_romeo", label: "Alfa Romeo", tier: "premium", country: "IT", order: 37 },
  { key: "jaguar", label: "Jaguar", tier: "premium", country: "GB", order: 38 },
  { key: "land_rover", label: "Land Rover / Range Rover", tier: "premium", country: "GB", order: 39 },

  // luxury
  { key: "porsche", label: "Porsche", tier: "luxury", country: "DE", order: 50 },
  { key: "maserati", label: "Maserati", tier: "luxury", country: "IT", order: 51 },
  { key: "bentley", label: "Bentley", tier: "luxury", country: "GB", order: 52 },
  { key: "rolls_royce", label: "Rolls-Royce", tier: "luxury", country: "GB", order: 53 },
  { key: "ferrari", label: "Ferrari", tier: "luxury", country: "IT", order: 54 },
  { key: "lamborghini", label: "Lamborghini", tier: "luxury", country: "IT", order: 55 },
  { key: "aston_martin", label: "Aston Martin", tier: "luxury", country: "GB", order: 56 },

  // ev
  { key: "tesla", label: "Tesla", tier: "premium", country: "US", order: 60 },
  { key: "togg", label: "Togg", tier: "premium", country: "TR", order: 61 },
  { key: "byd", label: "BYD", tier: "mass", country: "CN", order: 62 },

  // commercial
  { key: "iveco", label: "Iveco", tier: "commercial", country: "IT", order: 70 },
  { key: "isuzu", label: "Isuzu", tier: "commercial", country: "JP", order: 71 },
  { key: "man", label: "MAN", tier: "commercial", country: "DE", order: 72 },

  // motorcycle
  { key: "honda_moto", label: "Honda Motosiklet", tier: "motorcycle", country: "JP", order: 90 },
  { key: "yamaha", label: "Yamaha", tier: "motorcycle", country: "JP", order: 91 },
  { key: "ducati", label: "Ducati", tier: "motorcycle", country: "IT", order: 92 },
  { key: "kawasaki", label: "Kawasaki", tier: "motorcycle", country: "JP", order: 93 },
  { key: "bmw_motorrad", label: "BMW Motorrad", tier: "motorcycle", country: "DE", order: 94 },
];

export const BrandCoverageSchema = z.object({
  key: z.string(),
  is_authorized: z.boolean().default(false),
  is_premium_authorized: z.boolean().default(false),
  notes: z.string().optional(),
});
export type BrandCoverage = z.infer<typeof BrandCoverageSchema>;

export function brandsByTier(tier: BrandTier): BrandMeta[] {
  return BRAND_CATALOG.filter((b) => b.tier === tier).sort(
    (a, b) => a.order - b.order,
  );
}

export function getBrand(key: string): BrandMeta | undefined {
  return BRAND_CATALOG.find((b) => b.key === key);
}

export function brandTier(key: string): BrandTier | undefined {
  return getBrand(key)?.tier;
}
