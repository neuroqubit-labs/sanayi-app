import { buildTechnicianTrackingView, PRIMARY_TECHNICIAN_ID } from "@naro/mobile-core";
import { useQuery } from "@tanstack/react-query";

import { useJobsStore } from "@/features/jobs/store";
import { useTechnicianProfileStore } from "@/features/technicians";
import { mockDelay } from "@/shared/lib/mock";

import type { BusinessSummary } from "./types";

const DAILY_EARNINGS_MOCK_TRY = 2450;

function formatLira(amount: number): string {
  return `₺${amount.toLocaleString("tr-TR")}`;
}

export function useBusinessSummary() {
  const businessName = useTechnicianProfileStore((s) => s.name);
  const tagline = useTechnicianProfileStore((s) => s.tagline);
  const availability = useTechnicianProfileStore(
    (s) => s.availability === "available",
  );

  return useQuery<BusinessSummary>({
    queryKey: ["business", "summary", businessName, availability],
    queryFn: async () => {
      const cases = useJobsStore.getState().cases;
      const waitingCustomer = cases.filter(
        (caseItem) =>
          buildTechnicianTrackingView(caseItem).waitState.actor === "customer",
      ).length;

      return mockDelay({
        businessName,
        tagline,
        availability,
        stats: {
          activeJobs: cases.filter((caseItem) => caseItem.status !== "completed")
            .length,
          upcoming: waitingCustomer,
          weeklyJobs: cases.length + 8,
          dailyEarningsLabel: formatLira(DAILY_EARNINGS_MOCK_TRY),
        },
      });
    },
  });
}

export { PRIMARY_TECHNICIAN_ID };
