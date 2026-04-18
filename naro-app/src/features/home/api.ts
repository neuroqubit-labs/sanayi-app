import { useQuery } from "@tanstack/react-query";

import { mockDelay } from "@/shared/lib/mock";

import { mockHomeSummary } from "./data/fixtures";
import type { HomeSummary } from "./types";

export function useHomeSummary() {
  return useQuery<HomeSummary>({
    queryKey: ["home", "summary"],
    queryFn: () => mockDelay(mockHomeSummary),
  });
}
