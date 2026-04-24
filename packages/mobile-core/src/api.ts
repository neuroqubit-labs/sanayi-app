import type { TelemetryAdapter } from "./telemetry";
import { ApiError } from "./error";

type MaybePromise<T> = T | Promise<T>;

type JsonBody =
  | string
  | number
  | boolean
  | null
  | JsonBody[]
  | { [key: string]: JsonBody };

type RequestBody = NonNullable<RequestInit["body"]> | JsonBody;

export type ApiClientConfig = {
  baseUrl: string;
  authTokenProvider?: () => MaybePromise<string | null>;
  refreshAuthToken?: () => MaybePromise<string | null>;
  /**
   * Smoke report BUG 3 (2026-04-23): protected query hook'ları login
   * ekran mount'unda bile ateşleniyordu → BE log spam (401'ler). Bu
   * provider `true` döndürürse ve caller `auth:false` geçmediyse
   * request fırlatılmadan `ApiError("unauthenticated_suppressed")`
   * throw edilir. Default undefined → legacy davranış (hiçbir
   * filtreleme yok).
   */
  requireAuth?: () => boolean;
  telemetry?: TelemetryAdapter;
  timeoutMs?: number;
  getIsOnline?: () => boolean | undefined;
};

export type ApiRequestOptions<T> = Omit<RequestInit, "body"> & {
  auth?: string | false;
  body?: RequestBody;
  parse?: (value: unknown) => T;
  timeoutMs?: number;
};

export type ApiClient = <T = unknown>(path: string, options?: ApiRequestOptions<T>) => Promise<T>;

function createRequestId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isSerializableJsonBody(body: unknown): body is JsonBody {
  if (body === null || body === undefined) {
    // `undefined` nested field olarak geldiğinde JSON.stringify onu skip eder;
    // reject etmemeliyiz. Aksi halde `checksum_sha256: undefined` gibi opsiyonel
    // alanlar payload'ın tamamını fail ettiriyor.
    return true;
  }

  const bodyType = typeof body;
  if (bodyType === "string" || bodyType === "number" || bodyType === "boolean") {
    return true;
  }

  if (Array.isArray(body)) {
    return body.every(isSerializableJsonBody);
  }

  if (bodyType === "object") {
    return Object.values(body as Record<string, unknown>).every(isSerializableJsonBody);
  }

  return false;
}

function normalizeBody(body: ApiRequestOptions<unknown>["body"]) {
  if (body == null) {
    return { body: undefined, headers: {} as Record<string, string> };
  }

  if (typeof body === "string" || body instanceof FormData) {
    return { body, headers: {} as Record<string, string> };
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return { body, headers: {} as Record<string, string> };
  }

  if (!isSerializableJsonBody(body)) {
    throw new Error("Unsupported request body passed to API client");
  }

  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  };
}

function parseResponseBody(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const {
    authTokenProvider,
    baseUrl,
    getIsOnline,
    refreshAuthToken,
    requireAuth,
    telemetry,
    timeoutMs = 10_000,
  } = config;

  async function execute<T>(
    path: string,
    options: ApiRequestOptions<T> = {},
    allowRefresh = true,
  ): Promise<T> {
    const requestId = createRequestId();
    const method = options.method ?? "GET";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
    const url = `${baseUrl}${path}`;

    try {
      const authHeader =
        options.auth === false
          ? null
          : options.auth ?? (await authTokenProvider?.()) ?? null;

      // BUG 3 fix (2026-04-23): auth gerekli ve yok → request'i
      // hiç ateşleme. Caller explicit `auth:false` geçmişse public
      // akış sayılır ve bypass edilir. Throw edilen ApiError TanStack
      // Query tarafında error state'e düşer; login ekran mount'unda
      // BE log'una /vehicles/me + /cases/me 401 düşmez.
      if (
        options.auth !== false &&
        !authHeader &&
        requireAuth?.() === true
      ) {
        clearTimeout(timer);
        throw new ApiError(
          "Request suppressed: auth required but no token available",
          "http",
          requestId,
          401,
          { detail: { type: "unauthenticated_suppressed" } },
          url,
          method,
        );
      }
      const normalizedBody = normalizeBody(options.body);
      const headers: Record<string, string> = {
        ...normalizedBody.headers,
        ...(authHeader ? { Authorization: `Bearer ${authHeader}` } : {}),
        "X-Request-ID": requestId,
      };

      if (options.headers) {
        Object.assign(headers, options.headers as Record<string, string>);
      }

      const response = await fetch(url, {
        ...options,
        body: normalizedBody.body as RequestInit["body"],
        headers,
        signal: controller.signal,
      });

      const text = await response.text();
      const body = parseResponseBody(text);

      if (response.status === 401 && allowRefresh && refreshAuthToken) {
        const refreshedToken = await refreshAuthToken();
        if (refreshedToken) {
          return execute(
            path,
            {
              ...options,
              auth: refreshedToken,
            },
            false,
          );
        }
      }

      if (!response.ok) {
        throw new ApiError(
          `API error ${response.status}`,
          "http",
          requestId,
          response.status,
          body,
          url,
          method,
        );
      }

      try {
        return options.parse ? options.parse(body) : (body as T);
      } catch (error) {
        throw new ApiError(
          "API response parsing failed",
          "parse",
          requestId,
          response.status,
          body,
          url,
          method,
          { cause: error },
        );
      }
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : controller.signal.aborted
            ? new ApiError("API request timed out", "timeout", requestId, undefined, undefined, url, method, {
                cause: error,
              })
            : new ApiError(
                getIsOnline?.() === false ? "No network connection" : "Network request failed",
                getIsOnline?.() === false ? "offline" : "network",
                requestId,
                undefined,
                undefined,
                url,
                method,
                { cause: error },
              );

      telemetry?.captureError(apiError, {
        kind: apiError.kind,
        method,
        requestId,
        status: apiError.status,
        url,
      });

      throw apiError;
    } finally {
      clearTimeout(timer);
    }
  }

  return execute;
}
