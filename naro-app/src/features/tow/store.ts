import type {
  LatLng,
  TowCaseSnapshot,
  TowDispatchAttempt,
  TowDispatchStage,
  TowEvidence,
  TowEvidenceKind,
  TowOtpChallenge,
  TowRequest,
  TowServiceMode,
  TowTechnicianProfile,
} from "@naro/domain";
import {
  TOW_DEFAULT_QUOTE_PARAMS,
  computeTowCancellationFee,
  computeTowCap,
} from "@naro/domain";
import { create } from "zustand";

import {
  TOW_TECHNICIAN_POOL,
  type TowTechnicianSeed,
} from "./data/technicians";
import {
  buildRoutePoints,
  etaMinutes,
  haversineKm,
  lerpLatLng,
} from "./engine/geo";
import {
  addSecondsIso,
  generateOtpCode,
  nextId,
  nowIso,
} from "./engine/ids";

type TimerHandle = ReturnType<typeof setTimeout>;

type CaseTimers = {
  ticker?: TimerHandle;
  stageTimeouts: TimerHandle[];
};

type CreateImmediateInput = Omit<
  TowRequest,
  "mode" | "scheduled_at" | "fare_quote"
> & {
  scheduled_at?: null;
};

type CreateScheduledInput = Omit<
  TowRequest,
  "mode" | "fare_quote" | "scheduled_at"
> & {
  scheduled_at: string;
};

type TowStoreState = {
  cases: TowCaseSnapshot[];
  getCase: (id: string) => TowCaseSnapshot | null;
  createImmediate: (input: CreateImmediateInput) => TowCaseSnapshot;
  createScheduled: (input: CreateScheduledInput) => TowCaseSnapshot;
  cancel: (caseId: string, reason: string) => TowCaseSnapshot | null;
  verifyOtp: (
    caseId: string,
    code: string,
    purpose: "arrival" | "delivery",
  ) => { ok: boolean; snapshot: TowCaseSnapshot | null };
  submitEvidence: (
    caseId: string,
    kind: TowEvidenceKind,
    uploader: TowEvidence["uploader"],
    photo_url: string,
    caption?: string | null,
  ) => TowCaseSnapshot | null;
  submitRating: (
    caseId: string,
    rating: number,
    review_note?: string,
  ) => TowCaseSnapshot | null;
  __simulateTimeoutToPool: (caseId: string) => TowCaseSnapshot | null;
  __advanceStage: (
    caseId: string,
    stage: TowDispatchStage,
  ) => TowCaseSnapshot | null;
};

const MATCH_DELAY_MS = 3_000;
const EN_ROUTE_DELAY_MS = 2_000;
const GPS_TICK_MS = 2_000;
const DISPATCH_TO_PICKUP_DURATION_MS = 30_000;
const LOADING_DURATION_MS = 8_000;
const TRANSIT_DURATION_MS = 45_000;
const ARRIVAL_NEARBY_THRESHOLD_KM = 0.5;
const ARRIVAL_REACHED_THRESHOLD_KM = 0.05;

const timers = new Map<string, CaseTimers>();

function ensureTimers(caseId: string): CaseTimers {
  const existing = timers.get(caseId);
  if (existing) return existing;
  const created: CaseTimers = { stageTimeouts: [] };
  timers.set(caseId, created);
  return created;
}

function clearTimers(caseId: string) {
  const entry = timers.get(caseId);
  if (!entry) return;
  if (entry.ticker) clearInterval(entry.ticker);
  for (const handle of entry.stageTimeouts) {
    clearTimeout(handle);
  }
  timers.delete(caseId);
}

function buildFareQuote(
  mode: TowServiceMode,
  distanceKm: number,
  urgency: boolean,
) {
  const base = TOW_DEFAULT_QUOTE_PARAMS.base;
  const per_km = TOW_DEFAULT_QUOTE_PARAMS.per_km;
  const urgency_surcharge = urgency
    ? TOW_DEFAULT_QUOTE_PARAMS.urgency_surcharge
    : 0;
  const buffer_pct = TOW_DEFAULT_QUOTE_PARAMS.buffer_pct;
  const cap = computeTowCap({
    base,
    distance_km: distanceKm,
    per_km,
    urgency_surcharge,
    buffer_pct,
  });
  return {
    mode,
    base_amount: base,
    distance_km: distanceKm,
    per_km_rate: per_km,
    urgency_surcharge,
    buffer_pct,
    cap_amount: cap,
    locked_price: mode === "scheduled" ? cap : null,
    currency: "TRY",
  };
}

function buildInitialCase(
  request: TowRequest,
  initialStage: TowDispatchStage,
): TowCaseSnapshot {
  const iso = nowIso();
  return {
    id: nextId("tow"),
    created_at: iso,
    updated_at: iso,
    request,
    stage: initialStage,
    assigned_technician: null,
    current_location: null,
    route_points: [],
    eta_minutes: null,
    dispatch_attempts: [],
    evidence: [],
    otp_challenges: [],
    settlement_status: "pre_auth_holding",
    final_amount: null,
    cancellation_reason: null,
    cancellation_fee: null,
    rating: null,
    review_note: null,
  };
}

function toTowTechnicianProfile(seed: TowTechnicianSeed): TowTechnicianProfile {
  const { start_lat_lng: _start, avg_speed_kmh: _speed, ...profile } = seed;
  return profile;
}

function buildDispatchAttempt(
  seed: TowTechnicianSeed,
  pickup: LatLng,
  attemptOrder: number,
): TowDispatchAttempt {
  const distance = haversineKm(seed.start_lat_lng, pickup);
  return {
    id: nextId("attempt"),
    technician_id: seed.id,
    technician_name: seed.name,
    attempt_order: attemptOrder,
    sent_at: nowIso(),
    response_at: null,
    response: "pending",
    distance_km: Math.round(distance * 10) / 10,
    eta_minutes: etaMinutes(distance, seed.avg_speed_kmh),
  };
}

function pickImmediateCandidate(
  request: TowRequest,
): TowTechnicianSeed | null {
  if (!request.pickup_lat_lng) return null;
  const pickup = request.pickup_lat_lng;
  const sorted = [...TOW_TECHNICIAN_POOL].sort((a, b) => {
    const sameA = a.equipment === request.required_equipment ? 0 : 1;
    const sameB = b.equipment === request.required_equipment ? 0 : 1;
    if (sameA !== sameB) return sameA - sameB;
    return haversineKm(a.start_lat_lng, pickup) -
      haversineKm(b.start_lat_lng, pickup);
  });
  return sorted[0] ?? null;
}

function updateCase(
  list: TowCaseSnapshot[],
  caseId: string,
  patch: (snap: TowCaseSnapshot) => TowCaseSnapshot,
): { cases: TowCaseSnapshot[]; updated: TowCaseSnapshot | null } {
  let updated: TowCaseSnapshot | null = null;
  const next = list.map((snap) => {
    if (snap.id !== caseId) return snap;
    updated = { ...patch(snap), updated_at: nowIso() };
    return updated;
  });
  return { cases: next, updated };
}

export const useTowStore = create<TowStoreState>((set, get) => {
  function setCase(
    caseId: string,
    patch: (snap: TowCaseSnapshot) => TowCaseSnapshot,
  ) {
    let updated: TowCaseSnapshot | null = null;
    set((state) => {
      const result = updateCase(state.cases, caseId, patch);
      updated = result.updated;
      return { cases: result.cases };
    });
    return updated;
  }

  function startImmediateDispatchLoop(caseId: string) {
    const entry = ensureTimers(caseId);
    entry.stageTimeouts.push(
      setTimeout(() => {
        const snap = get().getCase(caseId);
        if (!snap || snap.stage !== "searching") return;
        const candidate = pickImmediateCandidate(snap.request);
        if (!candidate) return;

        const attempt = buildDispatchAttempt(
          candidate,
          snap.request.pickup_lat_lng!,
          1,
        );
        const techProfile = toTowTechnicianProfile(candidate);
        const distance = haversineKm(
          candidate.start_lat_lng,
          snap.request.pickup_lat_lng!,
        );
        const etaMin = etaMinutes(distance, candidate.avg_speed_kmh);
        const routePoints = buildRoutePoints(
          candidate.start_lat_lng,
          snap.request.pickup_lat_lng!,
        );

        setCase(caseId, (current) => ({
          ...current,
          stage: "accepted",
          assigned_technician: techProfile,
          current_location: candidate.start_lat_lng,
          route_points: routePoints,
          eta_minutes: etaMin,
          dispatch_attempts: [
            ...current.dispatch_attempts,
            { ...attempt, response: "accepted", response_at: nowIso() },
          ],
        }));

        const enRouteHandle = setTimeout(() => {
          setCase(caseId, (current) => ({ ...current, stage: "en_route" }));
          startPickupGpsTicker(
            caseId,
            candidate.start_lat_lng,
            snap.request.pickup_lat_lng!,
            candidate.avg_speed_kmh,
          );
        }, EN_ROUTE_DELAY_MS);
        entry.stageTimeouts.push(enRouteHandle);
      }, MATCH_DELAY_MS),
    );
  }

  function startPickupGpsTicker(
    caseId: string,
    from: LatLng,
    to: LatLng,
    avgSpeedKmh: number,
  ) {
    const entry = ensureTimers(caseId);
    if (entry.ticker) clearInterval(entry.ticker);
    const startTs = Date.now();

    entry.ticker = setInterval(() => {
      const snap = get().getCase(caseId);
      if (!snap) {
        clearInterval(entry.ticker!);
        return;
      }
      if (
        snap.stage !== "en_route" &&
        snap.stage !== "nearby"
      ) {
        clearInterval(entry.ticker!);
        return;
      }
      const t = Math.min(
        1,
        (Date.now() - startTs) / DISPATCH_TO_PICKUP_DURATION_MS,
      );
      const loc = lerpLatLng(from, to, t);
      const remainingKm = haversineKm(loc, to);
      const eta = etaMinutes(remainingKm, avgSpeedKmh);

      if (remainingKm <= ARRIVAL_REACHED_THRESHOLD_KM || t >= 1) {
        clearInterval(entry.ticker!);
        entry.ticker = undefined;
        onArrivedAtPickup(caseId, to);
        return;
      }

      const nextStage: TowDispatchStage =
        remainingKm <= ARRIVAL_NEARBY_THRESHOLD_KM ? "nearby" : "en_route";

      setCase(caseId, (current) => ({
        ...current,
        stage: nextStage,
        current_location: loc,
        eta_minutes: eta,
      }));
    }, GPS_TICK_MS);
  }

  function onArrivedAtPickup(caseId: string, pickup: LatLng) {
    const code = generateOtpCode();
    const issuedAt = nowIso();
    const otp: TowOtpChallenge = {
      code,
      purpose: "arrival",
      recipient: "customer",
      issued_at: issuedAt,
      expires_at: addSecondsIso(issuedAt, 10 * 60),
      verified_at: null,
    };
    setCase(caseId, (current) => ({
      ...current,
      stage: "arrived",
      current_location: pickup,
      eta_minutes: 0,
      otp_challenges: [...current.otp_challenges, otp],
    }));
  }

  function startTransitLoop(caseId: string) {
    const snap = get().getCase(caseId);
    if (!snap) return;
    const pickup = snap.request.pickup_lat_lng;
    const dropoff = snap.request.dropoff_lat_lng ?? pickup;
    if (!pickup || !dropoff) return;
    const tech = TOW_TECHNICIAN_POOL.find(
      (t) => t.id === snap.assigned_technician?.id,
    );
    const avgSpeed = tech?.avg_speed_kmh ?? 40;
    const routePoints = buildRoutePoints(pickup, dropoff);

    setCase(caseId, (current) => ({
      ...current,
      stage: "in_transit",
      route_points: routePoints,
      current_location: pickup,
    }));

    const entry = ensureTimers(caseId);
    if (entry.ticker) clearInterval(entry.ticker);
    const startTs = Date.now();
    let deliveryOtpIssued = false;

    entry.ticker = setInterval(() => {
      const current = get().getCase(caseId);
      if (!current || current.stage !== "in_transit") {
        clearInterval(entry.ticker!);
        return;
      }
      const t = Math.min(1, (Date.now() - startTs) / TRANSIT_DURATION_MS);
      const loc = lerpLatLng(pickup, dropoff, t);
      const remainingKm = haversineKm(loc, dropoff);
      const eta = etaMinutes(remainingKm, avgSpeed);

      if (!deliveryOtpIssued && t >= 0.85) {
        deliveryOtpIssued = true;
        const code = generateOtpCode();
        const issuedAt = nowIso();
        const otp: TowOtpChallenge = {
          code,
          purpose: "delivery",
          recipient: "delivery_recipient",
          issued_at: issuedAt,
          expires_at: addSecondsIso(issuedAt, 10 * 60),
          verified_at: null,
        };
        setCase(caseId, (curr) => ({
          ...curr,
          current_location: loc,
          eta_minutes: eta,
          otp_challenges: [...curr.otp_challenges, otp],
        }));
        return;
      }

      setCase(caseId, (curr) => ({
        ...curr,
        current_location: loc,
        eta_minutes: eta,
      }));
    }, GPS_TICK_MS);
  }

  return {
    cases: [],

    getCase: (id) => get().cases.find((c) => c.id === id) ?? null,

    createImmediate: (input) => {
      const pickup = input.pickup_lat_lng;
      const dropoff = input.dropoff_lat_lng ?? pickup;
      const distance =
        pickup && dropoff ? Math.max(haversineKm(pickup, dropoff), 1) : 5;
      const request: TowRequest = {
        ...input,
        mode: "immediate",
        scheduled_at: null,
        fare_quote: buildFareQuote("immediate", distance, true),
      };
      const snap = buildInitialCase(request, "searching");
      set((state) => ({ cases: [snap, ...state.cases] }));
      startImmediateDispatchLoop(snap.id);
      return snap;
    },

    createScheduled: (input) => {
      const pickup = input.pickup_lat_lng;
      const dropoff = input.dropoff_lat_lng ?? pickup;
      const distance =
        pickup && dropoff ? Math.max(haversineKm(pickup, dropoff), 1) : 5;
      const request: TowRequest = {
        ...input,
        mode: "scheduled",
        fare_quote: buildFareQuote("scheduled", distance, false),
      };
      const snap = buildInitialCase(request, "scheduled_waiting");
      set((state) => ({ cases: [snap, ...state.cases] }));
      return snap;
    },

    cancel: (caseId, reason) => {
      const snap = get().getCase(caseId);
      if (!snap) return null;
      const fee = computeTowCancellationFee(snap.request.mode, snap.stage);
      const isFullFare = fee === -1;
      const finalFee = isFullFare ? snap.request.fare_quote.cap_amount : fee;
      clearTimers(caseId);
      return setCase(caseId, (current) => ({
        ...current,
        stage: "cancelled",
        cancellation_reason: reason,
        cancellation_fee: finalFee,
        settlement_status: finalFee > 0 ? "final_charged" : "cancelled",
      }));
    },

    verifyOtp: (caseId, code, purpose) => {
      const snap = get().getCase(caseId);
      if (!snap) return { ok: false, snapshot: null };
      const challenge = [...snap.otp_challenges]
        .reverse()
        .find((c) => c.purpose === purpose && c.verified_at === null);
      if (!challenge) return { ok: false, snapshot: snap };
      if (challenge.code !== code.trim()) return { ok: false, snapshot: snap };

      const verifiedAt = nowIso();
      const updated = setCase(caseId, (current) => ({
        ...current,
        otp_challenges: current.otp_challenges.map((c) =>
          c === challenge ? { ...c, verified_at: verifiedAt } : c,
        ),
      }));

      if (purpose === "arrival") {
        setCase(caseId, (current) => ({ ...current, stage: "loading" }));
        const entry = ensureTimers(caseId);
        entry.stageTimeouts.push(
          setTimeout(() => {
            startTransitLoop(caseId);
          }, LOADING_DURATION_MS),
        );
      } else if (purpose === "delivery") {
        clearTimers(caseId);
        setCase(caseId, (current) => ({
          ...current,
          stage: "delivered",
          current_location:
            current.request.dropoff_lat_lng ?? current.current_location,
          eta_minutes: 0,
          final_amount: current.request.fare_quote.cap_amount,
          settlement_status: "final_charged",
        }));
      }

      return { ok: true, snapshot: updated };
    },

    submitEvidence: (caseId, kind, uploader, photo_url, caption = null) => {
      return setCase(caseId, (current) => ({
        ...current,
        evidence: [
          ...current.evidence,
          {
            id: nextId("evi"),
            case_id: current.id,
            kind,
            uploader,
            photo_url,
            caption,
            created_at: nowIso(),
          },
        ],
      }));
    },

    submitRating: (caseId, rating, review_note) => {
      return setCase(caseId, (current) => ({
        ...current,
        rating,
        review_note: review_note ?? null,
      }));
    },

    __simulateTimeoutToPool: (caseId) => {
      const snap = get().getCase(caseId);
      if (!snap || snap.stage !== "searching") return null;
      clearTimers(caseId);
      const updated = setCase(caseId, (current) => ({
        ...current,
        stage: "timeout_converted_to_pool",
      }));
      setTimeout(() => {
        setCase(caseId, (current) => ({
          ...current,
          stage: "scheduled_waiting",
        }));
      }, 800);
      return updated;
    },

    __advanceStage: (caseId, stage) => {
      return setCase(caseId, (current) => ({ ...current, stage }));
    },
  };
});
