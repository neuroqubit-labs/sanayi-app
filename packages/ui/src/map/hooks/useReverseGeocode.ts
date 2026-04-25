import type { LatLng } from "@naro/domain";
import { useEffect, useRef, useState } from "react";

export type ReverseGeocodeResult = {
  address: string;
  short_label: string;
  district?: string;
  city?: string;
  country_code: "TR";
  source: "mock" | "backend";
};

export type UseReverseGeocodeResult = {
  result: ReverseGeocodeResult | null;
  loading: boolean;
  error: Error | null;
};

/**
 * V1 fallback — backend `POST /api/v1/maps/reverse-geocode` henüz canlı değil;
 * koordinattan sahte ama okunabilir bir adres üretir. Gerçek entegrasyon Faz 4
 * backend proxy'si shipped olunca (`source: "backend"`).
 *
 * Çağrı tarafı hiçbir değişiklik yapmaz; sadece `source` alanı değişir.
 */
export function useReverseGeocode(
  coord: LatLng | null,
  options?: { debounceMs?: number },
): UseReverseGeocodeResult {
  const debounceMs = options?.debounceMs ?? 350;
  const [state, setState] = useState<UseReverseGeocodeResult>({
    result: null,
    loading: false,
    error: null,
  });
  const latestCoord = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!coord) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    latestCoord.current = coord;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const handle = setTimeout(() => {
      if (!latestCoord.current) return;
      if (
        latestCoord.current.lat !== coord.lat ||
        latestCoord.current.lng !== coord.lng
      ) {
        return;
      }
      try {
        const result = mockReverseGeocode(coord);
        setState({ result, loading: false, error: null });
      } catch (err) {
        setState({
          result: null,
          loading: false,
          error: err instanceof Error ? err : new Error("reverse geocode fail"),
        });
      }
    }, debounceMs);

    return () => {
      clearTimeout(handle);
    };
  }, [coord, debounceMs]);

  return state;
}

function mockReverseGeocode(coord: LatLng): ReverseGeocodeResult {
  // Sadece kaba yaklaşım — Türkiye ana şehir buckets
  const city = resolveCityBucket(coord);
  const districtIdx = Math.abs(
    Math.round(coord.lat * 1000) + Math.round(coord.lng * 1000),
  );
  const districts = CITY_DISTRICTS[city] ?? ["Merkez", "Yeni Mahalle"];
  const district = districts[districtIdx % districts.length] ?? "Merkez";

  const street = STREETS[districtIdx % STREETS.length] ?? "Atatürk Cd.";
  const houseNo = ((districtIdx * 17) % 240) + 1;

  return {
    address: `${street} No:${houseNo}, ${district}, ${city}`,
    short_label: `${district}, ${city}`,
    district,
    city,
    country_code: "TR",
    source: "mock",
  };
}

function resolveCityBucket(coord: LatLng): string {
  // Lat/lng aralıkları kaba (pilot kapsam):
  if (coord.lat > 40.8 && coord.lat < 41.3 && coord.lng > 28.5 && coord.lng < 29.5) {
    return "İstanbul";
  }
  if (coord.lat > 39.8 && coord.lat < 40.1 && coord.lng > 32.6 && coord.lng < 33.2) {
    return "Ankara";
  }
  if (coord.lat > 38.3 && coord.lat < 38.6 && coord.lng > 27.0 && coord.lng < 27.4) {
    return "İzmir";
  }
  if (coord.lat > 36.7 && coord.lat < 37.0 && coord.lng > 30.5 && coord.lng < 31.0) {
    return "Antalya";
  }
  if (coord.lat > 40.1 && coord.lat < 40.3 && coord.lng > 29.0 && coord.lng < 29.2) {
    return "Bursa";
  }
  if (coord.lat > 38.55 && coord.lat < 38.9 && coord.lng > 35.25 && coord.lng < 35.75) {
    return "Kayseri";
  }
  return "Türkiye";
}

const STREETS = [
  "Atatürk Cd.",
  "Cumhuriyet Cd.",
  "İnönü Bulv.",
  "Barış Sok.",
  "Bahçelievler Cd.",
  "Zafer Sok.",
  "Kazım Karabekir Cd.",
  "Millet Cd.",
];

const CITY_DISTRICTS: Record<string, string[]> = {
  İstanbul: [
    "Kadıköy",
    "Beşiktaş",
    "Şişli",
    "Maslak",
    "Levent",
    "Sarıyer",
    "Üsküdar",
    "Ataşehir",
  ],
  Ankara: ["Çankaya", "Yenimahalle", "Keçiören", "Mamak"],
  İzmir: ["Konak", "Bornova", "Alsancak", "Karşıyaka"],
  Antalya: ["Muratpaşa", "Konyaaltı", "Kepez"],
  Bursa: ["Osmangazi", "Nilüfer", "Yıldırım"],
  Kayseri: ["Melikgazi", "Kocasinan", "Talas"],
  Türkiye: ["Seçili konum"],
};
