import type { LatLng } from "@naro/domain";
import { create } from "zustand";

export type MapPickerPurpose =
  | "pickup"
  | "dropoff"
  | "vehicle_home"
  | "custom";

export type MapPickerResult = {
  coord: LatLng;
  address: string;
  short_label?: string;
};

type State = {
  /** Modal'ı açan taraf burayı doldurur — caller context. */
  session: string | null;
  purpose: MapPickerPurpose;
  initialCoord: LatLng | null;
  /**
   * Modal onayladığı zaman buraya yazılır; caller `useEffect` ile dinler,
   * okuduktan sonra `consume()` çağırır.
   */
  result: (MapPickerResult & { session: string }) | null;
  open: (args: {
    session: string;
    initialCoord?: LatLng | null;
    purpose?: MapPickerPurpose;
  }) => void;
  commit: (result: MapPickerResult) => void;
  cancel: () => void;
  consume: (session: string) => MapPickerResult | null;
};

/**
 * Modal-to-composer bridge store'u. Expo Router'da modal'dan caller'a
 * geri data passing için Zustand kanalı (navigation state ile coord
 * passing'den daha sade).
 *
 * Kullanım:
 * - Composer: `open({ session: "maintenance-pickup", initialCoord })`
 *   → `router.push("/harita-sec")`
 * - Modal: `useMapPicker` + onaylayınca `commit({ coord, address })`
 *   + `router.back()`
 * - Composer: `useEffect` ile `result.session === "maintenance-pickup"`
 *   ise `consume()` çağırıp `onCoordChange` + `onChange` set eder
 */
export const useMapPickerBridge = create<State>((set, get) => ({
  session: null,
  purpose: "pickup",
  initialCoord: null,
  result: null,
  open: ({ session, initialCoord = null, purpose = "pickup" }) => {
    set({
      session,
      initialCoord,
      purpose,
      result: null,
    });
  },
  commit: (result) => {
    const session = get().session;
    if (!session) return;
    set({ result: { ...result, session } });
  },
  cancel: () => {
    set({ session: null, result: null, initialCoord: null });
  },
  consume: (session) => {
    const current = get().result;
    if (!current || current.session !== session) return null;
    set({ result: null, session: null, initialCoord: null });
    return {
      coord: current.coord,
      address: current.address,
      short_label: current.short_label,
    };
  },
}));
