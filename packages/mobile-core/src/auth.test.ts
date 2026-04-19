import { describe, expect, it } from "vitest";

import { createAuthStore } from "./auth";
import { createSessionRepository } from "./session";
import { createMemoryStorageAdapter } from "./storage";

describe("createAuthStore", () => {
  it("hydrates from mock session when persistence is empty", async () => {
    const repository = createSessionRepository({
      storage: createMemoryStorageAdapter({
        namespace: "test.auth.mock",
        sessionKeys: ["access", "refresh"],
      }),
      keys: {
        accessToken: "access",
        refreshToken: "refresh",
      },
    });

    const useAuthStore = createAuthStore({
      repository,
      isMockAuthEnabled: true,
      mockSession: {
        accessToken: "mock-access",
        refreshToken: "mock-refresh",
      },
    });

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().bootstrapState).toBe("authenticated");
    expect(useAuthStore.getState().accessToken).toBe("mock-access");
  });

  it("persists approval status and blocked bootstrap state", async () => {
    const repository = createSessionRepository<"pending" | "active">({
      storage: createMemoryStorageAdapter({
        namespace: "test.auth.blocked",
        sessionKeys: ["access", "refresh", "approval"],
      }),
      keys: {
        accessToken: "access",
        refreshToken: "refresh",
        approvalStatus: "approval",
      },
    });

    const useAuthStore = createAuthStore({
      repository,
      evaluateBootstrapState: (session) => {
        if (!session.accessToken) {
          return "anonymous";
        }

        return session.approvalStatus === "pending" ? "blocked" : "authenticated";
      },
    });

    await useAuthStore.getState().setTokens("access", "refresh");
    await useAuthStore.getState().setApprovalStatus("pending");

    expect(useAuthStore.getState().bootstrapState).toBe("blocked");

    const persisted = await repository.read();
    expect(persisted.approvalStatus).toBe("pending");
  });
});
