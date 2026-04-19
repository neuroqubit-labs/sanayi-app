import type { BootstrapState } from "./auth";

type ResolveBootstrapHrefOptions = {
  bootstrapState: BootstrapState;
  anonymousHref: string;
  authenticatedHref: string;
  blockedHref?: string;
};

export function resolveBootstrapHref(options: ResolveBootstrapHrefOptions) {
  const { anonymousHref, authenticatedHref, blockedHref, bootstrapState } = options;

  switch (bootstrapState) {
    case "anonymous":
      return anonymousHref;
    case "blocked":
      return blockedHref ?? authenticatedHref;
    case "authenticated":
      return authenticatedHref;
    case "hydrating":
    default:
      return null;
  }
}
