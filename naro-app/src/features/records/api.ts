import { buildCustomerTrackingView } from "@naro/mobile-core";
import { useQuery } from "@tanstack/react-query";

import {
  getCaseProgressValue,
  getCaseRoute,
  getCaseStatusLabel,
  getCaseStatusTone,
  isActiveServiceCase,
} from "@/features/cases/presentation";
import { useCasesStore } from "@/features/cases/store";
import { useActiveVehicle } from "@/features/vehicles";
import { mockDelay } from "@/shared/lib/mock";

import type { RecordItem, RecordsFeed } from "./types";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";

export function useRecordsFeed() {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useQuery<RecordsFeed>({
    queryKey: ["records", vehicleId],
    queryFn: async (): Promise<RecordsFeed> => {
      const cases = useCasesStore
        .getState()
        .cases.filter((caseItem) => caseItem.vehicle_id === vehicleId)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

      const items: RecordItem[] = cases.map((caseItem) => {
        const trackingView = buildCustomerTrackingView(caseItem);

        return {
          id: caseItem.id,
          title: caseItem.title,
          subtitle: `${trackingView.header.waitLabel} · ${trackingView.header.summaryDescription}`,
          route: getCaseRoute(caseItem.id),
          dateLabel: caseItem.updated_at_label,
          amountLabel: caseItem.total_label ?? undefined,
          statusLabel: getCaseStatusLabel(caseItem.status),
          statusTone: getCaseStatusTone(caseItem.status),
          progressValue: getCaseProgressValue(caseItem.status),
          progressLabel: trackingView.header.nextLabel,
          kind: caseItem.kind,
          stateCategory: isActiveServiceCase(caseItem) ? "active" : "completed",
        };
      });

      return mockDelay({
        activeRecords: items.filter((item) => item.stateCategory === "active"),
        items: items.filter((item) => item.stateCategory === "completed"),
      });
    },
  });
}
