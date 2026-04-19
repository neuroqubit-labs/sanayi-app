import AsyncStorage from "@react-native-async-storage/async-storage";
import PostHog from "posthog-react-native";

import { createNoopFeatureFlagAdapter, type FeatureFlagAdapter } from "./feature-flags";
import { createNoopTelemetryAdapter, type TelemetryAdapter, type TelemetryUser } from "./telemetry";

type PostHogRuntimeConfig = {
  apiKey?: string;
  appName: string;
  disabled?: boolean;
  host?: string;
};

type ManagedObservabilityRuntime = {
  telemetry: TelemetryAdapter;
  featureFlags: FeatureFlagAdapter;
};

export function createPostHogRuntime(config: PostHogRuntimeConfig): ManagedObservabilityRuntime {
  const {
    apiKey,
    appName,
    disabled = false,
    host = "https://us.i.posthog.com",
  } = config;

  if (!apiKey || disabled) {
    return {
      featureFlags: createNoopFeatureFlagAdapter(),
      telemetry: createNoopTelemetryAdapter(),
    };
  }

  const resolvedApiKey = apiKey;
  let client: PostHog | null = null;

  function getClient() {
    if (!client) {
      client = new PostHog(resolvedApiKey, {
        customStorage: AsyncStorage,
        host,
        preloadFeatureFlags: true,
      });

      client.capture("$app_loaded", { app_name: appName });
    }

    return client;
  }

  function identifyUser(user: TelemetryUser) {
    const properties: Record<string, string | number | boolean | null> = {
      app_name: appName,
    };

    if (typeof user.email === "string") {
      properties.email = user.email;
    }
    if (typeof user.role === "string") {
      properties.role = user.role;
    }
    if (typeof user.username === "string") {
      properties.username = user.username;
    }

    getClient().identify(user.id, properties);
  }

  return {
    telemetry: {
      start: () => {
        getClient();
      },
      identify: identifyUser,
      setUser: (user) => {
        if (!user) {
          getClient().reset();
          return;
        }

        identifyUser(user);
      },
      track: (event, properties) => {
        getClient().capture(event, {
          app_name: appName,
          ...properties,
        });
      },
      captureError: (error, context) => {
        getClient().capture("$exception", {
          app_name: appName,
          context: context ? JSON.stringify(context) : null,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    },
    featureFlags: {
      start: () => {
        getClient();
      },
      isEnabled: async (flagKey, fallback = false) => {
        const variant = await getClient().getFeatureFlag(flagKey);
        if (typeof variant === "boolean") {
          return variant;
        }

        if (typeof variant === "string") {
          return variant !== "false";
        }

        return fallback;
      },
      getVariant: async (flagKey) => {
        return getClient().getFeatureFlag(flagKey);
      },
      reload: async () => {
        await getClient().reloadFeatureFlagsAsync();
      },
    },
  };
}
