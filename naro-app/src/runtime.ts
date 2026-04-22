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

const AppEnvSchema = z
  .object({
    EXPO_PUBLIC_API_URL: z.string().url().default("http://localhost:8000/api/v1"),
    EXPO_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    EXPO_PUBLIC_MOCK_AUTH: z.enum(["true", "false"]).default("false"),
    EXPO_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
    EXPO_PUBLIC_POSTHOG_KEY: z.string().default(""),
    EXPO_PUBLIC_SENTRY_DSN: z.union([z.string().url(), z.literal("")]).default(""),
  })
  .transform((values) => ({
    apiUrl: values.EXPO_PUBLIC_API_URL,
    appEnv: values.EXPO_PUBLIC_APP_ENV,
    mockAuth: values.EXPO_PUBLIC_MOCK_AUTH === "true",
    posthogHost: values.EXPO_PUBLIC_POSTHOG_HOST,
    posthogKey: values.EXPO_PUBLIC_POSTHOG_KEY || undefined,
    sentryDsn: values.EXPO_PUBLIC_SENTRY_DSN || undefined,
  }));

export const env = createExpoPublicEnv(AppEnvSchema);

export const storage = createPlatformStorageAdapter({
  namespace: "naro.app",
  sessionKeys: ["access_token", "refresh_token"],
});

const sessionRepository = createSessionRepository({
  storage,
  keys: {
    accessToken: "access_token",
    refreshToken: "refresh_token",
  },
});

const { featureFlags, telemetry: posthogTelemetry } = createPostHogRuntime({
  apiKey: env.posthogKey,
  appName: "naro-app",
  host: env.posthogHost,
});

const sentryTelemetry = createSentryTelemetryAdapter({
  appName: "naro-app",
  dsn: env.sentryDsn,
  environment: env.appEnv,
});

export const telemetry = combineTelemetryAdapters(sentryTelemetry, posthogTelemetry);

export const useAuthStore = createAuthStore({
  repository: sessionRepository,
  isMockAuthEnabled: env.mockAuth,
  mockSession: env.mockAuth
    ? {
        accessToken: "mock-access-token-customer",
        refreshToken: "mock-refresh-token-customer",
      }
    : undefined,
});

/**
 * 401 handler — apiClient expired access token için çağırır.
 * Başarılı: yeni access_token döner; ikinci deneme yeni token'la yapılır.
 * Başarısız: auth session temizlenir (bootstrapState → "anonymous");
 * _layout.tsx auth guard login'e yönlendirir.
 *
 * Çağrı apiClient bypass'lı doğrudan fetch (circular önle).
 */
async function refreshAuthToken(): Promise<string | null> {
  const authState = useAuthStore.getState();
  const refreshToken = authState.refreshToken;
  if (!refreshToken) {
    await authState.setSession({ accessToken: null, refreshToken: null });
    return null;
  }
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
  baseUrl: env.apiUrl,
  getIsOnline,
  telemetry,
});

export const mediaApi = createMediaApi(apiClient);

export const authApi = createOtpAuthApi({
  apiClient,
  role: "customer",
  isMockAuthEnabled: env.mockAuth,
  mockOtpResponse: {
    delivery_id: "mock-delivery",
    expires_in_seconds: 300,
  },
  mockTokens: {
    access_token: "mock-access-token-customer",
    refresh_token: "mock-refresh-token-customer",
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
