import { describe, expect, it } from "vitest";

import { createSessionRepository } from "./session";
import { createMemoryStorageAdapter } from "./storage";

describe("createSessionRepository", () => {
  it("reads and writes persisted session state", async () => {
    const storage = createMemoryStorageAdapter({
      namespace: "test.session",
      sessionKeys: ["access", "refresh", "approval"],
    });
    const repository = createSessionRepository<"pending" | "active">({
      storage,
      keys: {
        accessToken: "access",
        refreshToken: "refresh",
        approvalStatus: "approval",
      },
    });

    await repository.write({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      approvalStatus: "pending",
    });

    await expect(repository.read()).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      approvalStatus: "pending",
    });

    await repository.clear();

    await expect(repository.read()).resolves.toEqual({
      accessToken: null,
      refreshToken: null,
      approvalStatus: null,
    });
  });
});
