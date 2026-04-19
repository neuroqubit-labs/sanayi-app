import { resolveBootstrapHref } from "@naro/mobile-core";
import { Redirect } from "expo-router";

import { useAuthStore } from "@/services/auth/store";

export default function Index() {
  const bootstrapState = useAuthStore((state) => state.bootstrapState);
  const href = resolveBootstrapHref({
    anonymousHref: "/(auth)/login",
    authenticatedHref: "/(tabs)",
    bootstrapState,
  });

  if (!href) {
    return null;
  }

  return <Redirect href={href as never} />;
}
