import { useRouter, usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { useShellConfig } from "@/features/shell";

import { usePendingTowDispatch } from "./api";

const DISPATCH_ROUTE = "/cekici-dispatch";

export function useDispatchTakeover() {
  const shellConfig = useShellConfig();
  const hasTowCapability = shellConfig.enabled_capabilities.includes("tow");

  const pendingDispatch = usePendingTowDispatch(hasTowCapability);
  const incoming = pendingDispatch.data;
  const router = useRouter();
  const pathname = usePathname();
  const lastPushedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasTowCapability) return;

    const currentId = incoming?.id ?? null;
    const onDispatchRoute = pathname === DISPATCH_ROUTE;

    if (currentId && currentId !== lastPushedIdRef.current && !onDispatchRoute) {
      lastPushedIdRef.current = currentId;
      router.push(DISPATCH_ROUTE);
      return;
    }

    if (!currentId && onDispatchRoute) {
      lastPushedIdRef.current = null;
      router.back();
      return;
    }

    if (!currentId && lastPushedIdRef.current !== null && !onDispatchRoute) {
      lastPushedIdRef.current = null;
    }
  }, [hasTowCapability, incoming, pathname, router]);
}
