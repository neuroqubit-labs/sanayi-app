import {
  combineTelemetryAdapters,
  createApiClient,
  createAuthStore,
  createExpoPublicEnv,
  createMediaApi,
  createOtpAuthApi,
  createPlatformStorageAdapter,
  createPostHogRuntime,
  createQueryClient,
  createSessionRepository,
  createSentryTelemetryAdapter,
  getIsOnline,
  useInitializeApp,
  z,
} from "@naro/mobile-core";

export type ApprovalStatus = "pending" | "active" | "suspended";

const AppEnvSchema = z
  .object({
    EXPO_PUBLIC_API_URL: z.string().url().default("http://localhost:8000/api/v1"),
    EXPO_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    EXPO_PUBLIC_MOCK_APPROVAL: z.enum(["pending", "active", "suspended"]).default("active"),
    EXPO_PUBLIC_MOCK_AUTH: z.enum(["true", "false"]).default("false"),
    EXPO_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
    EXPO_PUBLIC_POSTHOG_KEY: z.string().default(""),
    EXPO_PUBLIC_SENTRY_DSN: z.union([z.string().url(), z.literal("")]).default(""),
  })
  .transform((values) => ({
    apiUrl: values.EXPO_PUBLIC_API_URL,
    appEnv: values.EXPO_PUBLIC_APP_ENV,
    mockApproval: values.EXPO_PUBLIC_MOCK_APPROVAL,
    mockAuth: values.EXPO_PUBLIC_MOCK_AUTH === "true",
    posthogHost: values.EXPO_PUBLIC_POSTHOG_HOST,
    posthogKey: values.EXPO_PUBLIC_POSTHOG_KEY || undefined,
    sentryDsn: values.EXPO_PUBLIC_SENTRY_DSN || undefined,
  }));

export const env = createExpoPublicEnv(AppEnvSchema);

export const storage = createPlatformStorageAdapter({
  namespace: "naro.service",
  sessionKeys: ["access_token", "refresh_token", "approval_status"],
});

const sessionRepository = createSessionRepository<ApprovalStatus>({
  storage,
  keys: {
    accessToken: "access_token",
    refreshToken: "refresh_token",
    approvalStatus: "approval_status",
  },
});

const { featureFlags, telemetry: posthogTelemetry } = createPostHogRuntime({
  apiKey: env.posthogKey,
  appName: "naro-service-app",
  host: env.posthogHost,
});

const sentryTelemetry = createSentryTelemetryAdapter({
  appName: "naro-service-app",
  dsn: env.sentryDsn,
  environment: env.appEnv,
});

export const telemetry = combineTelemetryAdapters(sentryTelemetry, posthogTelemetry);

export const useAuthStore = createAuthStore<ApprovalStatus>({
  repository: sessionRepository,
  isMockAuthEnabled: env.mockAuth,
  mockSession: env.mockAuth
    ? {
        accessToken: "mock-access-token-technician",
        refreshToken: "mock-refresh-token-technician",
        approvalStatus: env.mockApproval,
      }
    : undefined,
  evaluateBootstrapState: (session) => {
    if (!session.accessToken) {
      return "anonymous";
    }

    if (session.approvalStatus === "pending" || session.approvalStatus === "suspended") {
      return "blocked";
    }

    return "authenticated";
  },
});

/**
 * 401 handler — apiClient expired access token için çağırır.
 * Refresh fail → authStore clear → _layout auth guard login'e yönlendirir.
 *
 * Smoke report BUG 2 parity fix (2026-04-23):
 * - Concurrent 401 race mutex (inflight refresh tek promise).
 * - Hydrate tamamlanmadan refresh no-op (pre-hydrate boş tokenla 401
 *   yenir ve storage wipe edilmez).
 */
let inflightRefresh: Promise<string | null> | null = null;

async function refreshAuthToken(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = executeRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

async function executeRefresh(): Promise<string | null> {
  const authState = useAuthStore.getState();
  if (!authState.hydrated) return null;
  const refreshToken = authState.refreshToken;
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      throw new Error(`refresh failed ${response.status}`);
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
    await authState.setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch (err) {
    console.warn("refreshAuthToken failed; logging out", err);
    await authState.setSession({ accessToken: null, refreshToken: null });
    return null;
  }
}

export const apiClient = createApiClient({
  authTokenProvider: () => useAuthStore.getState().accessToken,
  refreshAuthToken,
  // BUG 3 fix parity (2026-04-23): korumalı request'i hydrate sonrası
  // accessToken yoksa ateşleme.
  requireAuth: () => {
    const state = useAuthStore.getState();
    return state.hydrated && !state.accessToken;
  },
  baseUrl: env.apiUrl,
  getIsOnline,
  telemetry,
});

export const mediaApi = createMediaApi(apiClient);

export const authApi = createOtpAuthApi({
  apiClient,
  role: "technician",
  isMockAuthEnabled: env.mockAuth,
  mockOtpResponse: {
    delivery_id: "mock-delivery",
    expires_in_seconds: 300,
  },
  mockTokens: {
    access_token: "mock-access-token-technician",
    refresh_token: "mock-refresh-token-technician",
    token_type: "bearer",
  },
});

export const queryClient = createQueryClient({ telemetry });

export function useInitializeRuntime() {
  useInitializeApp({
    featureFlags,
    telemetry,
    useAuthStore,
  });
}
