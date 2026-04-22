import { useMemo } from "react";

import { useMyCasesLive } from "@/features/cases/api";
import type { CaseSummaryResponse } from "@/features/cases/schemas/case-create";
import { useActiveVehicle } from "@/features/vehicles";

import type { ActiveProcess, HomeDecision, HomeSummary } from "./types";

const ACTIVE_STATUSES = new Set([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
]);

const STATUS_LABEL: Record<string, string> = {
  matching: "Eşleşme bekleniyor",
  offers_ready: "Teklifler geldi",
  appointment_pending: "Randevu bekleniyor",
  scheduled: "Randevu planlandı",
  service_in_progress: "Servis sürüyor",
  parts_approval: "Parça onayın bekleniyor",
  invoice_approval: "Fatura onayın bekleniyor",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  archived: "Arşivlendi",
};

const STATUS_PROGRESS: Record<string, number> = {
  matching: 12,
  offers_ready: 28,
  appointment_pending: 42,
  scheduled: 55,
  service_in_progress: 70,
  parts_approval: 80,
  invoice_approval: 90,
  completed: 100,
  cancelled: 100,
  archived: 100,
};

const STATUS_NEXT_STEP: Record<string, string> = {
  matching: "Ustalardan teklif geliyor",
  offers_ready: "Teklif seç",
  appointment_pending: "Onay bekleniyor",
  scheduled: "Randevu günü",
  service_in_progress: "Süreci takip et",
  parts_approval: "Parça kalemini onayla",
  invoice_approval: "Faturayı onayla",
};

const STATUS_PRIMARY_ACTION: Record<
  string,
  { label: string; routeSuffix: string } | undefined
> = {
  offers_ready: { label: "Teklifleri gör", routeSuffix: "" },
  parts_approval: { label: "Parça onayını aç", routeSuffix: "" },
  invoice_approval: { label: "Faturayı incele", routeSuffix: "" },
};

const KIND_LABEL: Record<string, string> = {
  accident: "Hasar / kaza",
  breakdown: "Arıza",
  maintenance: "Bakım",
  towing: "Çekici",
};

function isActive(caseItem: CaseSummaryResponse): boolean {
  return ACTIVE_STATUSES.has(caseItem.status);
}

function deriveActiveProcess(caseItem: CaseSummaryResponse): ActiveProcess {
  const statusLabel = STATUS_LABEL[caseItem.status] ?? caseItem.status;
  const progressValue = STATUS_PROGRESS[caseItem.status] ?? 0;
  const nextStepLabel = STATUS_NEXT_STEP[caseItem.status] ?? "Detayları aç";
  const primary = STATUS_PRIMARY_ACTION[caseItem.status];
  const kindLabel = KIND_LABEL[caseItem.kind] ?? caseItem.kind;
  const cardRoute = `/vaka/${caseItem.id}`;

  return {
    id: caseItem.id,
    servisAd: caseItem.title || kindLabel,
    title: caseItem.summary?.trim() || kindLabel,
    status: statusLabel,
    waitLabel: caseItem.status === "matching" ? "Sırada" : statusLabel,
    nextStepLabel,
    note: caseItem.location_label ?? "",
    progressLabel: `%${progressValue} tamamlandı`,
    progressValue,
    priceLabel: "Tutar netleşmedi",
    cardRoute,
    primaryActionLabel: primary?.label,
    primaryActionRoute: primary ? `${cardRoute}${primary.routeSuffix}` : undefined,
  };
}

function deriveCalmDecision(opts: {
  vehicleKm: number;
  totalCases: number;
  hasMaintenanceNote: boolean;
}): HomeDecision {
  const { vehicleKm, totalCases, hasMaintenanceNote } = opts;
  const maintenanceDue = hasMaintenanceNote;
  return {
    state: maintenanceDue ? "maintenance_due" : "quiet",
    eyebrow: maintenanceDue ? "Bakım zamanı" : "Hazırsın",
    title: maintenanceDue
      ? "Bakım için sakin bir pencere var"
      : "Bugün yeni bir talep açmak için temiz zemin var",
    description: maintenanceDue
      ? "Planlı bakım brief'ini önce kurarsan plansız duruş yerine kontrollü bir akışa girersin."
      : "Arıza, bakım, kaza veya çekici ihtiyacı için guided composer hazır.",
    statusLabel: maintenanceDue ? "Planlı" : "Sessiz dönem",
    statusTone: maintenanceDue ? "accent" : "info",
    cardRoute: maintenanceDue
      ? "/(modal)/talep/maintenance"
      : "/(modal)/talep/breakdown",
    primaryActionLabel: maintenanceDue
      ? "Bakım talebi oluştur"
      : "Yeni talep başlat",
    primaryActionRoute: maintenanceDue
      ? "/(modal)/talep/maintenance"
      : "/(modal)/quick-actions",
    secondaryActionLabel: "Ustaları gör",
    secondaryActionRoute: "/(tabs)/carsi",
    metrics: [
      {
        value: `${vehicleKm.toLocaleString("tr-TR")} km`,
        label: "Kilometre",
      },
      {
        value: totalCases.toString(),
        label: "Geçmiş vaka",
      },
      {
        value: maintenanceDue ? "Planlı" : "Sessiz",
        label: "Durum",
      },
    ],
    badges: [],
  };
}

export function useHomeSummary() {
  const { data: activeVehicle } = useActiveVehicle();
  const { data: cases, isPending, isError, refetch } = useMyCasesLive();

  const summary: HomeSummary | undefined = useMemo(() => {
    if (!cases) return undefined;
    const sorted = [...cases].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
    const activeCase = sorted.find(isActive) ?? null;
    const activeProcess = activeCase ? deriveActiveProcess(activeCase) : null;
    const decision = activeCase
      ? {
          state:
            activeCase.status === "offers_ready"
              ? ("offers_ready" as const)
              : ("service_in_progress" as const),
          eyebrow: STATUS_LABEL[activeCase.status] ?? activeCase.status,
          title: activeCase.title || (KIND_LABEL[activeCase.kind] ?? "Vaka"),
          description: activeCase.summary ?? "",
          statusLabel: STATUS_LABEL[activeCase.status] ?? activeCase.status,
          statusTone: "accent" as const,
          cardRoute: `/vaka/${activeCase.id}`,
          metrics: [],
          badges: [],
        }
      : deriveCalmDecision({
          vehicleKm: activeVehicle?.mileageKm ?? 0,
          totalCases: cases.length,
          hasMaintenanceNote: Boolean(
            activeVehicle?.note?.toLowerCase().includes("bakim"),
          ),
        });

    return {
      decision,
      activeProcess,
      taskQueue: [],
      recentActivity: [],
      suggestions: [],
      campaigns: [],
      nearbyServices: [],
    };
  }, [cases, activeVehicle?.mileageKm, activeVehicle?.note]);

  return {
    data: summary,
    isPending,
    isError,
    refetch,
  };
}
