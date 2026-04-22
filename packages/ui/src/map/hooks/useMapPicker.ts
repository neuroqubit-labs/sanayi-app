import type { LatLng } from "@naro/domain";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  useReverseGeocode,
  type ReverseGeocodeResult,
} from "./useReverseGeocode";
import { useGpsPermission, type UseGpsPermissionResult } from "./useGpsPermission";

export type FrequentPlace = {
  id: string;
  label: string;
  coord: LatLng;
  short_label?: string;
};

export type UseMapPickerOptions = {
  /** Açılışta göstermek istenen koordinat — varsa reverse geocode otomatik çalışır. */
  initialCoord?: LatLng | null;
  /** Kullanıcı "ev", "iş" vs. chip'lerinden birine basarsa doldurulur. */
  frequentPlaces?: FrequentPlace[];
  /** Kullanıcı pin'i her hareket ettiğinde çağrılır (komposer state'ine yazmak için). */
  onChange?: (next: { coord: LatLng; address: ReverseGeocodeResult | null }) => void;
  /** Reverse geocode debounce; default 350ms. */
  geocodeDebounceMs?: number;
};

export type UseMapPickerResult = {
  coord: LatLng | null;
  address: ReverseGeocodeResult | null;
  addressLoading: boolean;
  addressError: Error | null;

  /** Koordinatı manuel atar (harita üzerinde drag veya tap sonrası). */
  setCoord: (next: LatLng) => void;

  /** Frequent place chip'inden seçim. */
  selectFrequent: (place: FrequentPlace) => void;

  /** "Konumumu kullan" — GPS izin al + son konumu ata. */
  requestGps: () => Promise<{
    ok: boolean;
    coord?: LatLng;
    reason?: "permission_denied" | "location_unavailable" | "error";
  }>;

  /** Permission yardımcısı — composer'da "Ayarlara git" butonu için. */
  permission: UseGpsPermissionResult;

  /** GPS fetch sırasında loading (request butonu disable için). */
  gpsFetching: boolean;

  /** Listeye verilen frequent places — caller'ın verdiği pass-through. */
  frequentPlaces: FrequentPlace[];

  /** `coord` null'a çeker (reset). */
  clear: () => void;
};

/**
 * Composer map picker state — bakım + hasar + çekici pickup + dropoff tek
 * merkezden. Caller sadece `onChange` dinler; GPS izin + reverse geocode +
 * frequent places iç iş.
 */
export function useMapPicker(
  options: UseMapPickerOptions = {},
): UseMapPickerResult {
  const {
    initialCoord = null,
    frequentPlaces = [],
    onChange,
    geocodeDebounceMs,
  } = options;

  const [coord, setCoordState] = useState<LatLng | null>(initialCoord);
  const [gpsFetching, setGpsFetching] = useState(false);
  const permission = useGpsPermission();
  const geocode = useReverseGeocode(coord, { debounceMs: geocodeDebounceMs });

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (coord) {
      onChangeRef.current?.({ coord, address: geocode.result });
    }
  }, [coord, geocode.result]);

  const setCoord = useCallback((next: LatLng) => {
    setCoordState(next);
  }, []);

  const selectFrequent = useCallback((place: FrequentPlace) => {
    setCoordState(place.coord);
  }, []);

  const clear = useCallback(() => {
    setCoordState(null);
  }, []);

  const requestGps = useCallback(async () => {
    if (gpsFetching) {
      return { ok: false, reason: "error" as const };
    }
    setGpsFetching(true);
    try {
      let effectiveStatus = permission.status;
      if (effectiveStatus !== "granted") {
        effectiveStatus = await permission.request();
      }
      if (effectiveStatus !== "granted") {
        return { ok: false, reason: "permission_denied" as const };
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextCoord: LatLng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCoordState(nextCoord);
      return { ok: true, coord: nextCoord };
    } catch (err) {
      console.warn("useMapPicker: gps fetch failed", err);
      return { ok: false, reason: "location_unavailable" as const };
    } finally {
      setGpsFetching(false);
    }
  }, [gpsFetching, permission]);

  return {
    coord,
    address: geocode.result,
    addressLoading: geocode.loading,
    addressError: geocode.error,
    setCoord,
    selectFrequent,
    requestGps,
    permission,
    gpsFetching,
    frequentPlaces,
    clear,
  };
}
