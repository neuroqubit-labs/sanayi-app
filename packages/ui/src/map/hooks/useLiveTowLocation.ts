import type {
  LatLng,
  TowDispatchStage,
  TowLiveLocation,
  TowTechnicianProfile,
} from "@naro/domain";
import { useCallback, useEffect, useRef, useState } from "react";

export type CustomerTowEvent =
  | { type: "match_found"; tech: TowTechnicianProfile; eta_minutes: number }
  | { type: "stage_changed"; stage: TowDispatchStage; at: string }
  | { type: "location_update"; location: TowLiveLocation }
  | { type: "arrived"; pickup_otp: string }
  | { type: "loaded" }
  | { type: "delivered_pending_otp" }
  | { type: "delivered" }
  | { type: "cancelled"; reason: string }
  | {
      type: "fare_finalized";
      amount: number;
      refund: number | null;
    };

export type TechnicianTowEvent =
  | { type: "dispatch_offered"; case_id: string; expires_at: string }
  | { type: "dispatch_expired"; case_id: string }
  | { type: "stage_changed"; stage: TowDispatchStage; at: string }
  | { type: "location_update"; location: TowLiveLocation }
  | { type: "cancelled"; reason: string };

export type LiveTowRole = "customer" | "technician";

export type UseLiveTowLocationOptions = {
  /** Backend'den döndürülen `service_case.id` */
  caseId: string;
  /** Hangi taraftan bakılıyor — event filtrasyonu için. */
  role: LiveTowRole;
  /** Tam WS URL (`wss://…/ws/tow/{caseId}?token=…`). Caller auth ile birleştirir. */
  wsUrl: string | null;
  /**
   * Dispatch ömür döngüsü; `accepted → delivered/cancelled` aralığında
   * `enabled=true`. Terminal olunca caller `false` yapar, socket kapanır.
   */
  enabled?: boolean;
  /** Opsiyonel olay dinleyici — caller ayrıca event stream gerekirse. */
  onEvent?: (event: CustomerTowEvent | TechnicianTowEvent) => void;
};

export type UseLiveTowLocationResult = {
  /** Son konum; `location_update` event'lerden türetilir. */
  latest: TowLiveLocation | null;
  /** Konum geçmişi (en fazla `maxHistory`=200 nokta; FIFO). */
  history: TowLiveLocation[];
  isConnected: boolean;
  /** Server-pushed stage (arrival/delivery). Event'ten çıkartılır. */
  stage: TowDispatchStage | null;
  /** Stage 'arrived' olursa bu doldurulur. Customer tarafı müşteriye gösterir. */
  pickupOtp: string | null;
  /** Teknik bilgi — eşleşen usta bilgisi (match_found sonrası). */
  matchedTech: TowTechnicianProfile | null;
  /** Son hata — reconnect/gecici disconnect sırasında null'a dönmez. */
  error: Error | null;
  /** Manuel reconnect. */
  reconnect: () => void;
};

const MAX_HISTORY = 200;

/**
 * Live tow konum WebSocket subscription hook'u.
 *
 * V1 Faz 10 backend: `/ws/tow/{case_id}?token=…` — Redis pub/sub fan-out.
 * Bu iterasyonda temel WebSocket lifecycle + event parse + state update.
 *
 * Kapsam dışı (ilerdeki PR'lar):
 * - Offline → online reconnect + catch-up `resume_from` protokolü
 * - Heartbeat 30s
 * - Exponential backoff
 * - App background/foreground transition catch-up
 */
export function useLiveTowLocation({
  caseId,
  role,
  wsUrl,
  enabled = true,
  onEvent,
}: UseLiveTowLocationOptions): UseLiveTowLocationResult {
  const [latest, setLatest] = useState<TowLiveLocation | null>(null);
  const [history, setHistory] = useState<TowLiveLocation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stage, setStage] = useState<TowDispatchStage | null>(null);
  const [pickupOtp, setPickupOtp] = useState<string | null>(null);
  const [matchedTech, setMatchedTech] = useState<TowTechnicianProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !wsUrl) {
      return;
    }

    let cancelled = false;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("ws init failed"));
      return;
    }

    ws.onopen = () => {
      if (cancelled) return;
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
        const event = JSON.parse(raw) as
          | CustomerTowEvent
          | TechnicianTowEvent;
        applyEvent(event);
        onEventRef.current?.(event);
      } catch (err) {
        console.warn("useLiveTowLocation: failed to parse event", err);
      }
    };

    ws.onerror = (event) => {
      if (cancelled) return;
      setError(new Error(`ws error (${caseId})`));
    };

    ws.onclose = () => {
      if (cancelled) return;
      setIsConnected(false);
    };

    const applyEvent = (event: CustomerTowEvent | TechnicianTowEvent) => {
      switch (event.type) {
        case "location_update":
          setLatest(event.location);
          setHistory((prev) => {
            const next = [...prev, event.location];
            return next.length > MAX_HISTORY
              ? next.slice(next.length - MAX_HISTORY)
              : next;
          });
          break;
        case "stage_changed":
          setStage(event.stage);
          break;
        case "match_found":
          if (role === "customer") {
            setMatchedTech(event.tech);
          }
          break;
        case "arrived":
          if (role === "customer") {
            setPickupOtp(event.pickup_otp);
          }
          setStage("arrived");
          break;
        case "loaded":
          setStage("loading");
          break;
        case "delivered_pending_otp":
          setStage("in_transit");
          break;
        case "delivered":
          setStage("delivered");
          break;
        case "cancelled":
          setStage("cancelled");
          break;
        default:
          break;
      }
    };

    return () => {
      cancelled = true;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [caseId, role, wsUrl, enabled, reconnectKey]);

  const reconnect = useCallback(() => {
    setReconnectKey((k) => k + 1);
  }, []);

  return {
    latest,
    history,
    isConnected,
    stage,
    pickupOtp,
    matchedTech,
    error,
    reconnect,
  };
}

/**
 * Yardımcı — `LatLng` dizisine dönüştürmek için (RouteLine'a pasif besleme).
 */
export function historyToCoords(history: TowLiveLocation[]): LatLng[] {
  return history.map((l) => ({ lat: l.lat, lng: l.lng }));
}
