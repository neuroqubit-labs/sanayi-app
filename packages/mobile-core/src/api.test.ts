import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./error";
import { createApiClient } from "./api";

describe("createApiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("adds auth and request id headers and parses json responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ ok: true })),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const client = createApiClient({
      authTokenProvider: () => "token-123",
      baseUrl: "https://api.example.com",
    });

    const result = (await client("/health")) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.com/health");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "Bearer token-123",
      }),
    });
  });

  it("normalizes offline failures", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Network request failed")) as typeof fetch;

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      getIsOnline: () => false,
    });

    await expect(client("/health")).rejects.toMatchObject({
      kind: "offline",
      name: "ApiError",
    } satisfies Partial<ApiError>);
  });
});
