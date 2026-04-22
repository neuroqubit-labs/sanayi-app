import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

export type GpsPermissionStatus =
  | "unknown"
  | "granted"
  | "denied"
  | "restricted";

export type UseGpsPermissionResult = {
  status: GpsPermissionStatus;
  /** `status` 'granted' mı? Kısa kontrol için. */
  granted: boolean;
  /** Permission sheet/dialog çağırır; kullanıcı reddederse `denied`. */
  request: () => Promise<GpsPermissionStatus>;
  /** Sistem ayarlarını aç — kullanıcı "ayarlara git" butonuna bastığında. */
  openSettings: () => void;
  /** İç durum bilgisi — loading indikatörü için. */
  loading: boolean;
};

function mapExpoStatus(
  status: Location.LocationPermissionResponse["status"],
): GpsPermissionStatus {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "restricted";
}

/**
 * GPS izin akışı. Foreground permission sadece (V1). Background tracking
 * (usta çekici iş sırasında ekran kapalıyken) `useLiveLocationBroadcaster`
 * içinde ayrıca istenecek.
 *
 * Yaşam döngüsü:
 * - Mount'ta mevcut permission `getForegroundPermissionsAsync` ile okunur
 * - `request()` → `requestForegroundPermissionsAsync`
 * - App foreground'a geri dönünce yeniden check (kullanıcı ayarlardan
 *   değiştirmiş olabilir)
 */
export function useGpsPermission(): UseGpsPermissionResult {
  const [status, setStatus] = useState<GpsPermissionStatus>("unknown");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      setStatus(mapExpoStatus(response.status));
    } catch (err) {
      console.warn("useGpsPermission: failed to read permission", err);
      setStatus("restricted");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        refresh();
      }
    });
    return () => {
      sub.remove();
    };
  }, [refresh]);

  const request = useCallback(async (): Promise<GpsPermissionStatus> => {
    setLoading(true);
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      const mapped = mapExpoStatus(response.status);
      setStatus(mapped);
      return mapped;
    } catch (err) {
      console.warn("useGpsPermission: request failed", err);
      setStatus("restricted");
      return "restricted";
    } finally {
      setLoading(false);
    }
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }, []);

  return {
    status,
    granted: status === "granted",
    request,
    openSettings,
    loading,
  };
}
