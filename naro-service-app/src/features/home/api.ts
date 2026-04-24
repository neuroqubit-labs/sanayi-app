import { buildTechnicianTrackingView } from "@naro/mobile-core";

import { useJobsFeed } from "@/features/jobs";
import { useTechnicianProfileStore } from "@/features/technicians";

import type { BusinessSummary } from "./types";

const DAILY_EARNINGS_PLACEHOLDER_TRY = 2450;

function formatLira(amount: number): string {
  return `₺${amount.toLocaleString("tr-TR")}`;
}

export function useBusinessSummary() {
  const businessName = useTechnicianProfileStore((s) => s.name);
  const tagline = useTechnicianProfileStore((s) => s.tagline);
  const availability = useTechnicianProfileStore(
    (s) => s.availability === "available",
  );
  const jobsQuery = useJobsFeed();

  const jobs = jobsQuery.data ?? [];
  const waitingCustomer = jobs.filter(
    (caseItem) =>
      buildTechnicianTrackingView(caseItem).waitState.actor === "customer",
  ).length;

  const data: BusinessSummary | undefined = jobsQuery.data
    ? {
        businessName,
        tagline,
        availability,
        stats: {
          activeJobs: jobs.filter((caseItem) => caseItem.status !== "completed")
            .length,
          upcoming: waitingCustomer,
          weeklyJobs: jobs.length,
          dailyEarningsLabel: formatLira(DAILY_EARNINGS_PLACEHOLDER_TRY),
        },
      }
    : undefined;

  return { ...jobsQuery, data };
}
