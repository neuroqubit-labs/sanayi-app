import { useQuery } from "@tanstack/react-query";

import { useMyCasesLive } from "@/features/cases/api";
import {
  getCaseProgressValue,
  getCaseRoute,
  getCaseStatusLabel,
  getCaseStatusTone,
} from "@/features/cases/presentation";
import type { CaseSummaryResponse } from "@/features/cases/schemas/case-create";

import type { RecordItem, RecordsFeed } from "./types";

const ACTIVE_STATUSES = new Set([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
]);

function isActiveSummary(item: CaseSummaryResponse): boolean {
  return ACTIVE_STATUSES.has(item.status);
}

function formatDateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function toRecordItem(summary: CaseSummaryResponse): RecordItem {
  return {
    id: summary.id,
    title: summary.title,
    subtitle: summary.summary?.trim() || summary.location_label || "",
    route: getCaseRoute(summary.id),
    dateLabel: formatDateLabel(summary.updated_at),
    statusLabel: getCaseStatusLabel(summary.status),
    statusTone: getCaseStatusTone(summary.status),
    progressValue: getCaseProgressValue(summary.status),
    kind: summary.kind,
    stateCategory: isActiveSummary(summary) ? "active" : "completed",
  };
}

/**
 * Customer kayıtlar feed — canlı GET /cases/me.
 * Mock useCasesStore bağı koparıldı; araç/vaka yoksa boş döner →
 * RecordsScreen empty state gösterir.
 */
export function useRecordsFeed() {
  const cases = useMyCasesLive();

  return useQuery<RecordsFeed>({
    queryKey: ["records", "feed", cases.data?.map((c) => c.id).join(",") ?? ""],
    enabled: !cases.isPending,
    queryFn: () => {
      const sorted = [...(cases.data ?? [])].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      );
      const items = sorted.map(toRecordItem);
      return {
        activeRecords: items.filter((i) => i.stateCategory === "active"),
        items: items.filter((i) => i.stateCategory === "completed"),
      };
    },
  });
}
