import type { TowLiveLocation } from "@naro/domain";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useGpsPermission, type UseGpsPermissionResult } from "./useGpsPermission";

export type BroadcasterStatus =
  | "idle"
  | "awaiting_permission"
  | "streaming_foreground"
  | "streaming_background"
  | "offline_queued"
  | "paused"
  | "error";

export type LocationPostPayload = {
  case_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  captured_at: string; // ISO
  is_stationary: boolean;
  accuracy_m?: number | null;
};

export type UseLiveLocationBroadcasterOptions = {
  caseId: string;
  /**
   * Aktif çekici iş varken `true`. Terminal olunca (delivered/cancelled/
   * timeout) caller `false` yapar; stream durur, queue flush edilir.
   */
  active: boolean;
  /**
   * Gerçek POST çağrısı — caller inject eder (api client + auth token).
   * Başarılı dönerse (`Promise<void>`) queue'dan silinir; throw ederse
   * offline queue'a kalır.
   */
  sendLocation: (payload: LocationPostPayload) => Promise<void>;
  /** Fiziksel broadcast interval'i (ms). Default foreground 5000ms moving. */
  intervalMs?: number;
  /** Stationary (hız + delta küçük) detect için son konumdan min delta metre. */
  stationaryDeltaMeters?: number;
  /** Default 15000ms (stationary foreground). */
  stationaryIntervalMs?: number;
  /** Default 30000ms (background). */
  backgroundIntervalMs?: number;
};

export type UseLiveLocationBroadcasterResult = {
  status: BroadcasterStatus;
  /** Outbox'taki (henüz gönderilmemiş) ölçüm sayısı. */
  queueDepth: number;
  /** Permission state'i inspect etmek için. */
  permission: UseGpsPermissionResult;
  /** Bir sonraki tick'i beklemeden tek ölçüm gönder. */
  sendNow: () => Promise<void>;
  /** Stream'i manuel duraklat — örn. kullanıcı gizliliğe basarsa. */
  pause: () => void;
  resume: () => void;
  /** Son yakalanan konum (UI'da göstermek için). */
  lastSample: TowLiveLocation | null;
};

const DEFAULT_MOVING_MS = 5000;
const DEFAULT_STATIONARY_MS = 15000;
const DEFAULT_BACKGROUND_MS = 30000;
const DEFAULT_STATIONARY_DELTA_METERS = 8;
const MAX_QUEUE = 1000;

/**
 * Çekici (tech) tarafı — aktif iş boyunca GPS akışını backend'e iter.
 *
 * V1 kapsamı (bu iterasyon):
 * - expo-location foreground polling
 * - Moving/stationary adaptif interval
 * - In-memory queue (network fail sonrası retry)
 * - App background detect → background interval'e geç
 *
 * Kapsam dışı (ilerdeki PR'lar):
 * - AsyncStorage durable queue (kill → tekrar çalıştırma restore)
 * - Battery < 20% warning + <10% 15s force
 * - iOS significant location / Android foreground service (gerçek
 *   background tracking ekran kapalıyken) — `expo-task-manager` +
 *   `startLocationUpdatesAsync` ayrı PR
 * - Haversine move delta doğrulama (fake GPS filtresi)
 */
export function useLiveLocationBroadcaster({
  caseId,
  active,
  sendLocation,
  intervalMs = DEFAULT_MOVING_MS,
  stationaryDeltaMeters = DEFAULT_STATIONARY_DELTA_METERS,
  stationaryIntervalMs = DEFAULT_STATIONARY_MS,
  backgroundIntervalMs = DEFAULT_BACKGROUND_MS,
}: UseLiveLocationBroadcasterOptions): UseLiveLocationBroadcasterResult {
  const permission = useGpsPermission();
  const [status, setStatus] = useState<BroadcasterStatus>("idle");
  const [queueDepth, setQueueDepth] = useState(0);
  const [lastSample, setLastSample] = useState<TowLiveLocation | null>(null);
  const [paused, setPaused] = useState(false);

  const queueRef = useRef<LocationPostPayload[]>([]);
  const sendLocationRef = useRef(sendLocation);
  const prevSampleRef = useRef<TowLiveLocation | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);

  useEffect(() => {
    sendLocationRef.current = sendLocation;
  }, [sendLocation]);

  const isBackground = useCallback(
    () => appStateRef.current === "background" || appStateRef.current === "inactive",
    [],
  );

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const head = queueRef.current[0]!;
        try {
          await sendLocationRef.current(head);
          queueRef.current.shift();
          setQueueDepth(queueRef.current.length);
        } catch (err) {
          // Network fail — sonraki tick'te tekrar dene
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, []);

  const distanceMeters = (a: TowLiveLocation, b: TowLiveLocation) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  const captureOnce = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const sample: TowLiveLocation = {
        case_id: caseId,
        technician_id: "",
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading:
          typeof position.coords.heading === "number" &&
          position.coords.heading >= 0
            ? position.coords.heading
            : null,
        speed_kmh:
          typeof position.coords.speed === "number" && position.coords.speed >= 0
            ? Math.round(position.coords.speed * 3.6 * 10) / 10
            : null,
        captured_at: new Date(position.timestamp).toISOString(),
      };

      const prev = prevSampleRef.current;
      const stationaryBySpeed =
        sample.speed_kmh !== null && sample.speed_kmh < 2;
      const stationaryByDelta =
        prev !== null && distanceMeters(prev, sample) < stationaryDeltaMeters;
      const is_stationary = stationaryBySpeed || stationaryByDelta;

      prevSampleRef.current = sample;
      setLastSample(sample);

      const payload: LocationPostPayload = {
        case_id: caseId,
        lat: sample.lat,
        lng: sample.lng,
        heading: sample.heading,
        speed_kmh: sample.speed_kmh,
        captured_at: sample.captured_at,
        is_stationary,
        accuracy_m:
          typeof position.coords.accuracy === "number"
            ? position.coords.accuracy
            : null,
      };

      if (queueRef.current.length >= MAX_QUEUE) {
        queueRef.current.shift(); // FIFO drop
      }
      queueRef.current.push(payload);
      setQueueDepth(queueRef.current.length);
      await flushQueue();
      return is_stationary;
    } catch (err) {
      console.warn("useLiveLocationBroadcaster: capture failed", err);
      return false;
    }
  }, [caseId, flushQueue, stationaryDeltaMeters]);

  const scheduleNext = useCallback(
    (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (paused || !active) return;
        const stationary = await captureOnce();
        const nextDelay = isBackground()
          ? backgroundIntervalMs
          : stationary
            ? stationaryIntervalMs
            : intervalMs;
        setStatus(
          queueRef.current.length > 0
            ? "offline_queued"
            : isBackground()
              ? "streaming_background"
              : "streaming_foreground",
        );
        scheduleNext(nextDelay);
      }, delayMs);
    },
    [
      paused,
      active,
      captureOnce,
      isBackground,
      backgroundIntervalMs,
      stationaryIntervalMs,
      intervalMs,
    ],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setStatus("idle");
      // Son kalan queue flush edilir (best-effort)
      flushQueue();
      return;
    }
    if (paused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setStatus("paused");
      return;
    }
    if (permission.status === "unknown") {
      setStatus("awaiting_permission");
      return;
    }
    if (permission.status !== "granted") {
      setStatus("error");
      return;
    }
    scheduleNext(0);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [active, paused, permission.status, scheduleNext, flushQueue]);

  const sendNow = useCallback(async () => {
    if (!active || paused) return;
    if (permission.status !== "granted") return;
    await captureOnce();
  }, [active, paused, permission.status, captureOnce]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  return {
    status,
    queueDepth,
    permission,
    sendNow,
    pause,
    resume,
    lastSample,
  };
}
