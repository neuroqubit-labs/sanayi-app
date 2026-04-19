import { describe, expect, it } from "vitest";

import { resolveBootstrapHref } from "./routing";

describe("resolveBootstrapHref", () => {
  it("maps anonymous and authenticated states", () => {
    expect(
      resolveBootstrapHref({
        anonymousHref: "/login",
        authenticatedHref: "/home",
        bootstrapState: "anonymous",
      }),
    ).toBe("/login");

    expect(
      resolveBootstrapHref({
        anonymousHref: "/login",
        authenticatedHref: "/home",
        bootstrapState: "authenticated",
      }),
    ).toBe("/home");
  });

  it("supports blocked routes", () => {
    expect(
      resolveBootstrapHref({
        anonymousHref: "/login",
        authenticatedHref: "/home",
        blockedHref: "/pending",
        bootstrapState: "blocked",
      }),
    ).toBe("/pending");
  });
});
