import type { Href } from "expo-router";
import { useMemo } from "react";

import { useMyCasesLive } from "@/features/cases/api";
import type { CaseSummaryResponse } from "@/features/cases/schemas/case-create";

const TERMINAL_CASE_STATUSES = new Set(["completed", "cancelled", "archived"]);

function isActiveTowCase(caseItem: CaseSummaryResponse) {
  return (
    caseItem.kind === "towing" &&
    !TERMINAL_CASE_STATUSES.has(caseItem.status)
  );
}

function sortByRecency(cases: CaseSummaryResponse[]) {
  return [...cases].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

type TowEntryOptions = {
  vehicleId?: string | null;
  fallback?: Href;
};

export function findActiveTowCase(
  cases: CaseSummaryResponse[] | undefined,
  options: TowEntryOptions = {},
) {
  if (!cases || cases.length === 0) return null;

  const activeTowCases = sortByRecency(cases).filter(isActiveTowCase);
  if (activeTowCases.length === 0) return null;

  if (options.vehicleId) {
    const sameVehicle = activeTowCases.find(
      (caseItem) => caseItem.vehicle_id === options.vehicleId,
    );
    if (sameVehicle) return sameVehicle;
  }

  return activeTowCases[0] ?? null;
}

export function resolveTowEntryRoute(
  cases: CaseSummaryResponse[] | undefined,
  options: TowEntryOptions = {},
) {
  const activeTowCase = findActiveTowCase(cases, options);
  if (activeTowCase) {
    return `/cekici/${activeTowCase.id}` as Href;
  }
  return options.fallback ?? ("/(modal)/talep/towing" as Href);
}

export function useTowEntryRoute(options: TowEntryOptions = {}) {
  const myCasesQuery = useMyCasesLive();
  const vehicleId = options.vehicleId;
  const fallback = options.fallback;

  const route = useMemo(
    () =>
      resolveTowEntryRoute(myCasesQuery.data, {
        vehicleId,
        fallback,
      }),
    [fallback, myCasesQuery.data, vehicleId],
  );

  const activeTowCase = useMemo(
    () =>
      findActiveTowCase(myCasesQuery.data, {
        vehicleId,
      }),
    [myCasesQuery.data, vehicleId],
  );

  return {
    ...myCasesQuery,
    activeTowCase,
    route,
  };
}
