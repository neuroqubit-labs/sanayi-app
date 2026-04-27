import { useQuery } from "@tanstack/react-query";

import { useMyCasesLive } from "@/features/cases/api";
import {
  ACTIVE_CASE_STATUSES,
  getCaseProgressValue,
  getCaseOffersRoute,
  getCaseRoute,
  getCaseStatusLabel,
  getCaseStatusTone,
} from "@/features/cases/presentation";
import type { CaseSummaryResponse } from "@/features/cases/schemas/case-create";
import { useVehicles, useVehicleStore, type Vehicle } from "@/features/vehicles";

import type { RecordBadgeTone, RecordItem, RecordsFeed } from "./types";

const ACTIVE_STATUSES = new Set(ACTIVE_CASE_STATUSES);

const KIND_LABEL: Record<RecordItem["kind"], string> = {
  accident: "Hasar",
  breakdown: "Arıza",
  maintenance: "Bakım",
  towing: "Çekici",
};

const STATUS_NEXT_STEP: Record<string, string> = {
  matching: "Ustalardan yanıt bekleniyor",
  offers_ready: "Teklif seçimi",
  appointment_pending: "Randevu yanıtı",
  scheduled: "Randevu günü",
  service_in_progress: "Süreç takibi",
  parts_approval: "Parça onayı",
  invoice_approval: "Fatura onayı",
  completed: "Tamamlandı",
  cancelled: "Kapandı",
  archived: "Arşivde",
};

const STATUS_PRIMARY_ACTION: Record<string, string | undefined> = {
  offers_ready: "Teklifleri gör",
  parts_approval: "Parçayı incele",
  invoice_approval: "Faturayı incele",
};

const URGENCY_LABEL: Record<string, { label: string; tone: RecordBadgeTone }> = {
  planned: { label: "Planlı", tone: "neutral" },
  today: { label: "Bugün", tone: "info" },
  urgent: { label: "Acil", tone: "critical" },
};

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

function getRecordRoute(summary: CaseSummaryResponse): string {
  return summary.kind === "towing"
    ? `/cekici/${summary.id}`
    : getCaseRoute(summary.id);
}

function getPrimaryActionRoute(summary: CaseSummaryResponse): string {
  if (summary.status === "offers_ready" || summary.has_active_offers) {
    return summary.kind === "towing"
      ? getRecordRoute(summary)
      : getCaseOffersRoute(summary.id);
  }
  return getRecordRoute(summary);
}

function getVehicleLabel(vehicle?: Vehicle): string | undefined {
  if (!vehicle) return undefined;
  return `${vehicle.plate} · ${vehicle.make} ${vehicle.model}`;
}

function toRecordItem(
  summary: CaseSummaryResponse,
  vehicle?: Vehicle,
): RecordItem {
  const isActive = isActiveSummary(summary);
  const hasOffers = summary.has_active_offers || summary.active_offer_count > 0;
  const route = getRecordRoute(summary);
  const updatedLabel = formatDateLabel(summary.updated_at);
  const statusLabel = hasOffers && isActive
    ? "Yeni teklif gelenler"
    : getCaseStatusLabel(summary.status);
  const urgency = URGENCY_LABEL[summary.urgency];

  return {
    id: summary.id,
    vehicleId: summary.vehicle_id,
    title: summary.title,
    subtitle: summary.summary?.trim() || summary.location_label || "",
    route,
    dateLabel: updatedLabel,
    createdLabel: formatDateLabel(summary.created_at),
    updatedLabel,
    statusLabel,
    statusTone: hasOffers && isActive ? "accent" : getCaseStatusTone(summary.status),
    progressValue: getCaseProgressValue(summary.status),
    progressLabel: STATUS_NEXT_STEP[summary.status] ?? "Detayları aç",
    kind: summary.kind,
    kindLabel: KIND_LABEL[summary.kind],
    vehicleLabel: getVehicleLabel(vehicle),
    locationLabel: summary.location_label ?? undefined,
    offerCount: summary.active_offer_count,
    hasOffers,
    nextStepLabel: hasOffers && isActive
      ? "Teklifleri karşılaştır"
      : (STATUS_NEXT_STEP[summary.status] ?? "Detayları aç"),
    urgencyLabel: urgency?.label,
    urgencyTone: urgency?.tone,
    primaryActionLabel: isActive
      ? hasOffers
        ? "Teklifleri gör"
        : STATUS_PRIMARY_ACTION[summary.status]
      : undefined,
    primaryActionRoute: isActive ? getPrimaryActionRoute(summary) : undefined,
    stateCategory: isActive ? "active" : "completed",
  };
}

/**
 * Customer kayıtlar feed — canlı GET /cases/me.
 * **Aktif araca göre filtrelenir** — RecordsScreen header'ındaki VehiclePill
 * ile seçilen araç store'a yazılır, feed onu okur. `activeVehicleId` boşsa
 * tüm vakaları döner (ilk mount / araç yokken geçerli).
 */
export function useRecordsFeed() {
  const cases = useMyCasesLive();
  const vehicles = useVehicles();
  const activeVehicleId = useVehicleStore((s) => s.activeVehicleId);

  return useQuery<RecordsFeed>({
    queryKey: [
      "records",
      "feed",
      activeVehicleId || "all",
      cases.data?.map((c) => c.id).join(",") ?? "",
      vehicles.data?.map((v) => `${v.id}:${v.plate}`).join(",") ?? "",
    ],
    enabled: !cases.isPending && !vehicles.isPending,
    queryFn: () => {
      const vehicleById = new Map(
        (vehicles.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
      );
      const scoped = activeVehicleId
        ? (cases.data ?? []).filter((c) => c.vehicle_id === activeVehicleId)
        : (cases.data ?? []);
      const sorted = [...scoped].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      );
      const items = sorted.map((item) =>
        toRecordItem(item, vehicleById.get(item.vehicle_id)),
      );
      return {
        activeRecords: items.filter((i) => i.stateCategory === "active"),
        items: items.filter((i) => i.stateCategory === "completed"),
      };
    },
  });
}
