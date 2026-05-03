import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { apiClient, storage, telemetry, useAuthStore } from "@/runtime";

const INSTALLATION_ID_KEY = "installation_id";

/**
 * Cihaz başına benzersiz, kalıcı installation_id. SecureStore-backed
 * adapter'da saklanır; uninstall'da kaybolur (yeni install yeni id alır).
 * Cryptographic değil; uniqueness için yeterli güç.
 */
async function ensureInstallationId(): Promise<string> {
  const existing = await storage.get(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const fresh = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await storage.set(INSTALLATION_ID_KEY, fresh);
  return fresh;
}

/**
 * Auth sonrası device push token'ı al + BE'ye idempotent POST.
 *
 * Akış:
 *   1. Permission iste (Android 13+ POST_NOTIFICATIONS runtime; iOS init).
 *   2. Reddedilirse sessizce çık — kullanıcı sonra Profil ekranından
 *      manuel açabilir (V1.1).
 *   3. Kabul edilirse `getDevicePushTokenAsync()` ile native token al.
 *   4. POST /users/me/push-tokens (idempotent: device_id sabit).
 *
 * Auth durumunda her launch çağrılır (last_seen_at güncellensin).
 * BE auth dep zaten user_id'yi JWT'den çıkarır; FE user_id göndermez.
 */
export function usePushTokenRegistration() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    if (registeredFor.current === accessToken) return;

    let cancelled = false;
    (async () => {
      try {
        const settings = await Notifications.getPermissionsAsync();
        let granted =
          settings.granted ||
          settings.ios?.status ===
            Notifications.IosAuthorizationStatus.PROVISIONAL;

        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          granted =
            requested.granted ||
            requested.ios?.status ===
              Notifications.IosAuthorizationStatus.PROVISIONAL;
        }

        if (!granted || cancelled) return;

        const tokenData = await Notifications.getDevicePushTokenAsync();
        if (cancelled) return;

        const installationId = await ensureInstallationId();
        const platform: "ios" | "android" =
          Platform.OS === "ios" ? "ios" : "android";

        await apiClient("/users/me/push-tokens", {
          method: "POST",
          body: {
            platform,
            token: String(tokenData.data),
            device_id: installationId,
          },
        });
        registeredFor.current = accessToken;
      } catch (error) {
        telemetry.captureError(error, {
          context: "push token registration failed",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);
}
