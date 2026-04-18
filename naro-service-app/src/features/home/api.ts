import { useQuery } from "@tanstack/react-query";

import { mockDelay } from "@/shared/lib/mock";

import { mockBusinessSummary } from "./data/fixtures";
import type { BusinessSummary } from "./types";

export function useBusinessSummary() {
  return useQuery<BusinessSummary>({
    queryKey: ["business", "summary"],
    queryFn: () => mockDelay(mockBusinessSummary),
  });
}
