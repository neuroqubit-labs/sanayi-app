import { useQuery } from "@tanstack/react-query";

import { mockDelay } from "@/shared/lib/mock";

import { mockVehicles } from "./data/fixtures";
import type { Vehicle } from "./types";

export function useVehicles() {
  return useQuery<Vehicle[]>({
    queryKey: ["vehicles"],
    queryFn: () => mockDelay(mockVehicles),
  });
}

export function useActiveVehicle() {
  return useQuery<Vehicle | null>({
    queryKey: ["vehicles", "active"],
    queryFn: () => mockDelay(mockVehicles.find((v) => v.isActive) ?? null),
  });
}
