import type {
  LatLng,
  TowDispatchStage,
  TowEvidenceKind,
  TowRequest,
} from "@naro/domain";
import { create } from "zustand";

type TowActiveJob = {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_lat_lng: LatLng;
  pickup_label: string;
  dropoff_lat_lng: LatLng | null;
  dropoff_label: string | null;
  vehicle_plate: string;
  vehicle_description: string;
  request: TowRequest;
  stage: TowDispatchStage;
  current_location: LatLng;
  arrival_otp_code: string;
  delivery_otp_code: string;
  arrival_otp_verified: boolean;
  delivery_otp_verified: boolean;
  evidence_kinds_submitted: TowEvidenceKind[];
  accepted_at: string;
  eta_minutes: number;
};

type IncomingDispatch = {
  id: string;
  customer_name: string;
  pickup_label: string;
  pickup_lat_lng: LatLng;
  dropoff_label: string | null;
  distance_km: number;
  eta_minutes: number;
  price_amount: number;
  equipment_label: string;
  received_at: string;
  expires_at: string;
};

type TowServiceStoreState = {
  is_active: boolean;
  starting_location: LatLng;
  active_job: TowActiveJob | null;
  incoming_dispatch: IncomingDispatch | null;
  completed_count: number;
  total_earnings: number;

  activate: () => void;
  deactivate: () => void;
  simulateIncomingDispatch: () => void;
  acceptDispatch: () => TowActiveJob | null;
  declineDispatch: () => void;
  markEnRoute: () => void;
  markArrived: () => void;
  verifyArrivalOtp: (code: string) => { ok: boolean };
  markLoading: () => void;
  markInTransit: () => void;
  verifyDeliveryOtp: (code: string) => { ok: boolean };
  submitEvidence: (kind: TowEvidenceKind) => void;
  finish: () => void;
};

const DEFAULT_START: LatLng = { lat: 41.0521, lng: 28.9867 };

const SAMPLE_DISPATCH: IncomingDispatch = {
  id: "dsp-sample-1",
  customer_name: "Erdal Bey",
  pickup_label: "TEM Otoyolu, Beşiktaş yönü, Bostancı gişe sonrası",
  pickup_lat_lng: { lat: 40.9557, lng: 29.0937 },
  dropoff_label: "Güngören Sanayi, AutoPro Servis",
  distance_km: 14.2,
  eta_minutes: 22,
  price_amount: 2640,
  equipment_label: "Flatbed (yatay platform)",
  received_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 15_000).toISOString(),
};

export const useTowServiceStore = create<TowServiceStoreState>((set, get) => ({
  is_active: false,
  starting_location: DEFAULT_START,
  active_job: null,
  incoming_dispatch: null,
  completed_count: 0,
  total_earnings: 0,

  activate: () => set({ is_active: true }),
  deactivate: () => set({ is_active: false, incoming_dispatch: null }),

  simulateIncomingDispatch: () => {
    const { is_active, active_job } = get();
    if (!is_active || active_job) return;
    set({
      incoming_dispatch: {
        ...SAMPLE_DISPATCH,
        id: `dsp-${Date.now()}`,
        received_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15_000).toISOString(),
      },
    });
  },

  acceptDispatch: () => {
    const { incoming_dispatch, starting_location } = get();
    if (!incoming_dispatch) return null;
    const nowIso = new Date().toISOString();
    const fakeRequest: TowRequest = {
      mode: "immediate",
      pickup_lat_lng: incoming_dispatch.pickup_lat_lng,
      pickup_label: incoming_dispatch.pickup_label,
      dropoff_lat_lng: null,
      dropoff_label: incoming_dispatch.dropoff_label,
      vehicle_id: "veh-demo",
      incident_reason: "not_running",
      required_equipment: "flatbed",
      scheduled_at: null,
      fare_quote: {
        mode: "immediate",
        base_amount: 950,
        distance_km: incoming_dispatch.distance_km,
        per_km_rate: 70,
        urgency_surcharge: 80,
        buffer_pct: 0.1,
        cap_amount: incoming_dispatch.price_amount,
        locked_price: null,
        currency: "TRY",
      },
      kasko: {
        has_kasko: false,
        pre_auth_on_customer_card: true,
      },
      attachments: [],
    };
    const job: TowActiveJob = {
      id: `job-${incoming_dispatch.id}`,
      customer_name: incoming_dispatch.customer_name,
      customer_phone: "+905331002244",
      pickup_lat_lng: incoming_dispatch.pickup_lat_lng,
      pickup_label: incoming_dispatch.pickup_label,
      dropoff_lat_lng: { lat: 41.0203, lng: 28.8801 },
      dropoff_label: incoming_dispatch.dropoff_label,
      vehicle_plate: "34 ABC 42",
      vehicle_description: "BMW 3 Serisi · Koyu Gri",
      request: fakeRequest,
      stage: "accepted",
      current_location: starting_location,
      arrival_otp_code: "4872",
      delivery_otp_code: "9261",
      arrival_otp_verified: false,
      delivery_otp_verified: false,
      evidence_kinds_submitted: [],
      accepted_at: nowIso,
      eta_minutes: incoming_dispatch.eta_minutes,
    };
    set({ incoming_dispatch: null, active_job: job });
    return job;
  },

  declineDispatch: () => set({ incoming_dispatch: null }),

  markEnRoute: () => {
    const { active_job } = get();
    if (!active_job) return;
    set({ active_job: { ...active_job, stage: "en_route" } });
  },

  markArrived: () => {
    const { active_job } = get();
    if (!active_job) return;
    set({
      active_job: {
        ...active_job,
        stage: "arrived",
        current_location: active_job.pickup_lat_lng,
        eta_minutes: 0,
      },
    });
  },

  verifyArrivalOtp: (code) => {
    const { active_job } = get();
    if (!active_job) return { ok: false };
    if (code.trim() !== active_job.arrival_otp_code) return { ok: false };
    set({ active_job: { ...active_job, arrival_otp_verified: true } });
    return { ok: true };
  },

  markLoading: () => {
    const { active_job } = get();
    if (!active_job || !active_job.arrival_otp_verified) return;
    set({ active_job: { ...active_job, stage: "loading" } });
  },

  markInTransit: () => {
    const { active_job } = get();
    if (!active_job) return;
    set({ active_job: { ...active_job, stage: "in_transit" } });
  },

  verifyDeliveryOtp: (code) => {
    const { active_job } = get();
    if (!active_job) return { ok: false };
    if (code.trim() !== active_job.delivery_otp_code) return { ok: false };
    set({ active_job: { ...active_job, delivery_otp_verified: true } });
    return { ok: true };
  },

  submitEvidence: (kind) => {
    const { active_job } = get();
    if (!active_job) return;
    if (active_job.evidence_kinds_submitted.includes(kind)) return;
    set({
      active_job: {
        ...active_job,
        evidence_kinds_submitted: [
          ...active_job.evidence_kinds_submitted,
          kind,
        ],
      },
    });
  },

  finish: () => {
    const { active_job } = get();
    if (!active_job || !active_job.delivery_otp_verified) return;
    set((state) => ({
      active_job: { ...active_job, stage: "delivered" },
      completed_count: state.completed_count + 1,
      total_earnings:
        state.total_earnings + active_job.request.fare_quote.cap_amount,
    }));
    setTimeout(() => {
      const current = get().active_job;
      if (current && current.stage === "delivered") {
        set({ active_job: null });
      }
    }, 4_000);
  },
}));

export type { TowActiveJob, IncomingDispatch };
