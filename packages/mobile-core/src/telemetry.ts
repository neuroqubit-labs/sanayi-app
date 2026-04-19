import * as Sentry from "@sentry/react-native";

import { getErrorMessage } from "./error";

export type TelemetryUser = {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  [key: string]: unknown;
};

export interface TelemetryAdapter {
  start?: () => Promise<void> | void;
  identify: (user: TelemetryUser) => void;
  setUser: (user: TelemetryUser | null) => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
  captureError: (error: unknown, context?: Record<string, unknown>) => void;
}

type SentryTelemetryConfig = {
  appName: string;
  dsn?: string;
  environment: string;
  enabled?: boolean;
  tracesSampleRate?: number;
};

export function createNoopTelemetryAdapter(): TelemetryAdapter {
  return {
    identify: () => {},
    setUser: () => {},
    track: () => {},
    captureError: () => {},
  };
}

export function combineTelemetryAdapters(...adapters: TelemetryAdapter[]): TelemetryAdapter {
  return {
    start: async () => {
      await Promise.all(adapters.map((adapter) => adapter.start?.()));
    },
    identify: (user) => {
      adapters.forEach((adapter) => adapter.identify(user));
    },
    setUser: (user) => {
      adapters.forEach((adapter) => adapter.setUser(user));
    },
    track: (event, properties) => {
      adapters.forEach((adapter) => adapter.track(event, properties));
    },
    captureError: (error, context) => {
      adapters.forEach((adapter) => adapter.captureError(error, context));
    },
  };
}

export function createSentryTelemetryAdapter(config: SentryTelemetryConfig): TelemetryAdapter {
  const { appName, dsn, enabled = Boolean(dsn), environment, tracesSampleRate = 0.1 } = config;
  let started = false;

  function canUseSentry() {
    return Boolean(enabled && dsn);
  }

  return {
    start: () => {
      if (!canUseSentry() || started) {
        return;
      }

      Sentry.init({
        dsn,
        enabled,
        environment,
        tracesSampleRate,
      });

      Sentry.setTag("app_name", appName);
      started = true;
    },
    identify: (user) => {
      if (!canUseSentry()) {
        return;
      }

      Sentry.setUser({
        email: user.email,
        id: user.id,
        role: typeof user.role === "string" ? user.role : undefined,
        username: user.username,
      });
    },
    setUser: (user) => {
      if (!canUseSentry()) {
        return;
      }

      Sentry.setUser(
        user
          ? {
              email: user.email,
              id: user.id,
              role: typeof user.role === "string" ? user.role : undefined,
              username: user.username,
            }
          : null,
      );
    },
    track: (event, properties) => {
      if (!canUseSentry()) {
        return;
      }

      Sentry.addBreadcrumb({
        category: "analytics",
        data: properties,
        level: "info",
        message: event,
      });
    },
    captureError: (error, context) => {
      if (!canUseSentry()) {
        return;
      }

      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        if (error instanceof Error) {
          Sentry.captureException(error);
          return;
        }

        Sentry.captureMessage(getErrorMessage(error));
      });
    },
  };
}
