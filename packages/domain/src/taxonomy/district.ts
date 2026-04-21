import { z } from "zod";

export type CityMeta = {
  code: string;
  label: string;
  region: string;
};

export type DistrictMeta = {
  id: string;
  city_code: string;
  label: string;
  center_lat?: number;
  center_lng?: number;
};

export const CITY_CATALOG: CityMeta[] = [
  { code: "34", label: "İstanbul", region: "Marmara" },
  { code: "06", label: "Ankara", region: "İç Anadolu" },
  { code: "35", label: "İzmir", region: "Ege" },
  { code: "16", label: "Bursa", region: "Marmara" },
  { code: "07", label: "Antalya", region: "Akdeniz" },
  { code: "01", label: "Adana", region: "Akdeniz" },
  { code: "26", label: "Eskişehir", region: "İç Anadolu" },
  { code: "10", label: "Balıkesir", region: "Marmara" },
  { code: "38", label: "Kayseri", region: "İç Anadolu" },
  { code: "41", label: "Kocaeli", region: "Marmara" },
  { code: "42", label: "Konya", region: "İç Anadolu" },
  { code: "55", label: "Samsun", region: "Karadeniz" },
  { code: "27", label: "Gaziantep", region: "Güneydoğu" },
];

export const DISTRICT_CATALOG: DistrictMeta[] = [
  // İstanbul — Avrupa
  { id: "34-sariyer", city_code: "34", label: "Sarıyer", center_lat: 41.1669, center_lng: 29.0502 },
  { id: "34-besiktas", city_code: "34", label: "Beşiktaş", center_lat: 41.0423, center_lng: 29.0083 },
  { id: "34-sisli", city_code: "34", label: "Şişli", center_lat: 41.0602, center_lng: 28.9887 },
  { id: "34-kagithane", city_code: "34", label: "Kağıthane", center_lat: 41.0847, center_lng: 28.9716 },
  { id: "34-eyupsultan", city_code: "34", label: "Eyüpsultan", center_lat: 41.055, center_lng: 28.924 },
  { id: "34-gaziosmanpasa", city_code: "34", label: "Gaziosmanpaşa", center_lat: 41.076, center_lng: 28.909 },
  { id: "34-fatih", city_code: "34", label: "Fatih", center_lat: 41.017, center_lng: 28.954 },
  { id: "34-bakirkoy", city_code: "34", label: "Bakırköy", center_lat: 40.982, center_lng: 28.877 },
  { id: "34-bahcelievler", city_code: "34", label: "Bahçelievler", center_lat: 41.002, center_lng: 28.858 },
  { id: "34-kucukcekmece", city_code: "34", label: "Küçükçekmece", center_lat: 41.004, center_lng: 28.775 },
  { id: "34-buyukcekmece", city_code: "34", label: "Büyükçekmece", center_lat: 41.021, center_lng: 28.592 },
  { id: "34-avcilar", city_code: "34", label: "Avcılar", center_lat: 40.979, center_lng: 28.718 },
  { id: "34-esenyurt", city_code: "34", label: "Esenyurt", center_lat: 41.035, center_lng: 28.672 },
  { id: "34-basaksehir", city_code: "34", label: "Başakşehir", center_lat: 41.0971, center_lng: 28.8022 },
  { id: "34-arnavutkoy", city_code: "34", label: "Arnavutköy", center_lat: 41.1853, center_lng: 28.7403 },
  { id: "34-beylikduzu", city_code: "34", label: "Beylikdüzü", center_lat: 41.002, center_lng: 28.641 },
  { id: "34-silivri", city_code: "34", label: "Silivri", center_lat: 41.074, center_lng: 28.246 },
  { id: "34-catalca", city_code: "34", label: "Çatalca", center_lat: 41.144, center_lng: 28.464 },

  // İstanbul — Anadolu
  { id: "34-uskudar", city_code: "34", label: "Üsküdar", center_lat: 41.025, center_lng: 29.033 },
  { id: "34-kadikoy", city_code: "34", label: "Kadıköy", center_lat: 40.99, center_lng: 29.028 },
  { id: "34-atasehir", city_code: "34", label: "Ataşehir", center_lat: 40.984, center_lng: 29.107 },
  { id: "34-maltepe", city_code: "34", label: "Maltepe", center_lat: 40.935, center_lng: 29.155 },
  { id: "34-kartal", city_code: "34", label: "Kartal", center_lat: 40.901, center_lng: 29.191 },
  { id: "34-pendik", city_code: "34", label: "Pendik", center_lat: 40.874, center_lng: 29.234 },
  { id: "34-tuzla", city_code: "34", label: "Tuzla", center_lat: 40.816, center_lng: 29.299 },
  { id: "34-umraniye", city_code: "34", label: "Ümraniye", center_lat: 41.026, center_lng: 29.106 },
  { id: "34-cekmekoy", city_code: "34", label: "Çekmeköy", center_lat: 41.032, center_lng: 29.185 },
  { id: "34-sancaktepe", city_code: "34", label: "Sancaktepe", center_lat: 41.001, center_lng: 29.232 },
  { id: "34-sultanbeyli", city_code: "34", label: "Sultanbeyli", center_lat: 40.962, center_lng: 29.268 },
  { id: "34-beykoz", city_code: "34", label: "Beykoz", center_lat: 41.118, center_lng: 29.102 },

  // Ankara
  { id: "06-cankaya", city_code: "06", label: "Çankaya", center_lat: 39.888, center_lng: 32.862 },
  { id: "06-kecioren", city_code: "06", label: "Keçiören", center_lat: 39.975, center_lng: 32.864 },
  { id: "06-yenimahalle", city_code: "06", label: "Yenimahalle", center_lat: 39.956, center_lng: 32.79 },
  { id: "06-mamak", city_code: "06", label: "Mamak", center_lat: 39.928, center_lng: 32.934 },
  { id: "06-etimesgut", city_code: "06", label: "Etimesgut", center_lat: 39.956, center_lng: 32.68 },
  { id: "06-sincan", city_code: "06", label: "Sincan", center_lat: 39.965, center_lng: 32.582 },
  { id: "06-altindag", city_code: "06", label: "Altındağ", center_lat: 39.945, center_lng: 32.895 },
  { id: "06-pursaklar", city_code: "06", label: "Pursaklar", center_lat: 40.038, center_lng: 32.902 },
  { id: "06-golbasi", city_code: "06", label: "Gölbaşı", center_lat: 39.788, center_lng: 32.813 },

  // İzmir
  { id: "35-konak", city_code: "35", label: "Konak", center_lat: 38.418, center_lng: 27.128 },
  { id: "35-karsiyaka", city_code: "35", label: "Karşıyaka", center_lat: 38.459, center_lng: 27.106 },
  { id: "35-bornova", city_code: "35", label: "Bornova", center_lat: 38.467, center_lng: 27.216 },
  { id: "35-buca", city_code: "35", label: "Buca", center_lat: 38.389, center_lng: 27.175 },
  { id: "35-gaziemir", city_code: "35", label: "Gaziemir", center_lat: 38.316, center_lng: 27.152 },
  { id: "35-cigli", city_code: "35", label: "Çiğli", center_lat: 38.493, center_lng: 27.065 },
  { id: "35-bayrakli", city_code: "35", label: "Bayraklı", center_lat: 38.461, center_lng: 27.161 },
  { id: "35-karabaglar", city_code: "35", label: "Karabağlar", center_lat: 38.387, center_lng: 27.112 },
  { id: "35-narlidere", city_code: "35", label: "Narlıdere", center_lat: 38.392, center_lng: 27.002 },
];

export const DistrictRefSchema = z.object({
  id: z.string(),
  city_code: z.string(),
  label: z.string(),
});
export type DistrictRef = z.infer<typeof DistrictRefSchema>;

export function districtsByCity(city_code: string): DistrictMeta[] {
  return DISTRICT_CATALOG.filter((d) => d.city_code === city_code);
}

export function getDistrict(id: string): DistrictMeta | undefined {
  return DISTRICT_CATALOG.find((d) => d.id === id);
}

export function getCity(code: string): CityMeta | undefined {
  return CITY_CATALOG.find((c) => c.code === code);
}

/** Approximate great-circle distance in km between two coordinates. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * District auto-suggest: return districts whose centers fall within `radiusKm`
 * of the given coordinate. Only districts with known centers participate.
 */
export function suggestDistrictsInRadius(
  lat: number,
  lng: number,
  radiusKm: number,
  cityCode?: string,
): DistrictMeta[] {
  const pool = cityCode
    ? DISTRICT_CATALOG.filter((d) => d.city_code === cityCode)
    : DISTRICT_CATALOG;
  return pool.filter(
    (d) =>
      d.center_lat != null &&
      d.center_lng != null &&
      haversineKm(lat, lng, d.center_lat, d.center_lng) <= radiusKm,
  );
}
