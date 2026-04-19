import { useEffect } from "react";
import type { StoreApi, UseBoundStore } from "zustand";

import type { AuthStoreState } from "./auth";
import type { FeatureFlagAdapter } from "./feature-flags";
import { initializeNetworkManagers } from "./network";
import type { TelemetryAdapter } from "./telemetry";

type UseInitializeAppOptions<TStatus extends string> = {
  useAuthStore: UseBoundStore<StoreApi<AuthStoreState<TStatus>>>;
  telemetry?: TelemetryAdapter;
  featureFlags?: FeatureFlagAdapter;
};

export function useInitializeApp<TStatus extends string>(
  options: UseInitializeAppOptions<TStatus>,
) {
  const { featureFlags, telemetry, useAuthStore } = options;
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    initializeNetworkManagers();
    void telemetry?.start?.();
    void featureFlags?.start?.();
    void hydrate();
  }, [featureFlags, hydrate, telemetry]);
}
