import { describe, expect, it } from "vitest";

import { createExpoPublicEnv, z } from "./env";

describe("createExpoPublicEnv", () => {
  it("parses and transforms Expo public variables", () => {
    const schema = z
      .object({
        EXPO_PUBLIC_API_URL: z.string().url(),
        EXPO_PUBLIC_MOCK_AUTH: z.enum(["true", "false"]).default("false"),
      })
      .transform((value) => ({
        apiUrl: value.EXPO_PUBLIC_API_URL,
        mockAuth: value.EXPO_PUBLIC_MOCK_AUTH === "true",
      }));

    const env = createExpoPublicEnv(schema, {
      EXPO_PUBLIC_API_URL: "https://api.example.com",
      EXPO_PUBLIC_MOCK_AUTH: "true",
    });

    expect(env.apiUrl).toBe("https://api.example.com");
    expect(env.mockAuth).toBe(true);
  });

  it("fails fast on invalid env", () => {
    const schema = z.object({
      EXPO_PUBLIC_API_URL: z.string().url(),
    });

    expect(() =>
      createExpoPublicEnv(schema, {
        EXPO_PUBLIC_API_URL: "not-a-url",
      }),
    ).toThrow("Invalid Expo public environment configuration");
  });
});
