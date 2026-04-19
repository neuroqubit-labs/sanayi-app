export interface FeatureFlagAdapter {
  start?: () => Promise<void> | void;
  isEnabled: (flagKey: string, fallback?: boolean) => Promise<boolean>;
  getVariant: (flagKey: string) => Promise<string | boolean | undefined>;
  reload: () => Promise<void>;
}

export function createNoopFeatureFlagAdapter(): FeatureFlagAdapter {
  return {
    isEnabled: async (_flagKey, fallback = false) => fallback,
    getVariant: async () => undefined,
    reload: async () => {},
  };
}
