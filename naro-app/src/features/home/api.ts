import { buildCustomerTrackingView } from "@naro/mobile-core";
import { useQuery } from "@tanstack/react-query";

import {
  CASE_CAMPAIGNS,
  CASE_NEARBY_SERVICES,
} from "@/features/cases/data/fixtures";
import {
  getCaseTrackingRoute,
  isActiveServiceCase,
} from "@/features/cases/presentation";
import { useCasesStore } from "@/features/cases/store";
import { mockTechnicianMatchesByVehicle } from "@/features/ustalar/data/fixtures";
import { useActiveVehicle } from "@/features/vehicles";
import { mockDelay } from "@/shared/lib/mock";

import type { HomeSummary } from "./types";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";
const DEFAULT_SUGGESTIONS =
  mockTechnicianMatchesByVehicle[DEFAULT_VEHICLE_ID] ?? [];

type HomeBadgeTone = HomeSummary["decision"]["badges"][number]["tone"];
type HomeActivityTone = HomeSummary["recentActivity"][number]["tone"];

function toHomeBadgeTone(tone: "customer" | "technician" | "system") {
  switch (tone) {
    case "customer":
      return "warning" as const;
    case "technician":
      return "accent" as const;
    case "system":
      return "info" as const;
  }
}

function normalizeActivityTone(
  tone: HomeSummary["decision"]["statusTone"],
): HomeActivityTone {
  return tone === "neutral" ? "info" : tone;
}

function stageToneToBadgeTone(
  state: "completed_compact" | "active_expanded" | "upcoming_visible" | "blocked" | "waiting_counterparty",
): HomeBadgeTone {
  switch (state) {
    case "completed_compact":
      return "success";
    case "active_expanded":
      return "accent";
    case "blocked":
      return "critical";
    case "waiting_counterparty":
      return "warning";
    case "upcoming_visible":
      return "info";
  }
}

export function useHomeSummary() {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useQuery<HomeSummary>({
    queryKey: ["home", "summary", vehicleId],
    queryFn: async (): Promise<HomeSummary> => {
      const maintenanceDue =
        activeVehicle?.note?.toLowerCase().includes("bakim") ?? false;
      const cases = useCasesStore
        .getState()
        .cases.filter((caseItem) => caseItem.vehicle_id === vehicleId)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
      const activeCase = cases.find(isActiveServiceCase) ?? null;
      const trackingView = activeCase ? buildCustomerTrackingView(activeCase) : null;
      const suggestions =
        mockTechnicianMatchesByVehicle[vehicleId] ?? DEFAULT_SUGGESTIONS;
      const campaigns =
        CASE_CAMPAIGNS[vehicleId as keyof typeof CASE_CAMPAIGNS] ??
        CASE_CAMPAIGNS[DEFAULT_VEHICLE_ID];
      const nearbyServices =
        CASE_NEARBY_SERVICES[vehicleId as keyof typeof CASE_NEARBY_SERVICES] ??
        CASE_NEARBY_SERVICES[DEFAULT_VEHICLE_ID];

      const secondaryUtility = trackingView?.utilityPreviews.find(
        (item) => item.route && item.kind !== "service_profile",
      );

      const decision: HomeSummary["decision"] = trackingView && activeCase
        ? {
            state:
              activeCase.status === "offers_ready"
                ? "offers_ready"
                : "service_in_progress",
            eyebrow: trackingView.header.eyebrow,
            title: trackingView.header.summaryTitle,
            description: trackingView.header.summaryDescription,
            statusLabel: trackingView.header.statusLabel,
            statusTone: trackingView.header.statusTone,
            cardRoute: getCaseTrackingRoute(activeCase.id),
            primaryActionLabel: trackingView.primaryAction?.label,
            primaryActionRoute: trackingView.primaryAction?.route,
            secondaryActionLabel: secondaryUtility?.title,
            secondaryActionRoute: secondaryUtility?.route,
            metrics: [
              {
                value: trackingView.header.waitLabel,
                label: "Bekleyen taraf",
              },
              {
                value: trackingView.header.totalLabel ?? "-",
                label: "Guncel tutar",
              },
              {
                value:
                  trackingView.header.estimateLabel ?? trackingView.header.nextLabel,
                label: trackingView.header.estimateLabel
                  ? "Yaklasik bitis"
                  : "Sonraki esik",
              },
            ],
            badges: [
              {
                id: "wait-state",
                label: trackingView.header.waitLabel,
                tone: toHomeBadgeTone(
                  trackingView.waitState.actor === "none"
                    ? "system"
                    : trackingView.waitState.actor,
                ),
              },
              ...trackingView.stages
                .filter((stage) => stage.isNew)
                .map((stage) => ({
                  id: stage.id,
                  label: stage.title,
                  tone: stageToneToBadgeTone(stage.state),
                })),
            ].slice(0, 3),
          }
        : {
            state: maintenanceDue ? "maintenance_due" : "quiet",
            eyebrow: maintenanceDue ? "Bakim zamani" : "Hazirsin",
            title: maintenanceDue
              ? "Bakim icin sakin ama net bir pencere var"
              : "Bugun yeni bir talep acmak icin temiz bir zemin var",
            description: maintenanceDue
              ? "Planli bakim brief'ini once kurarsan plansiz durus yerine kontrollu bir akisa girersin."
              : "Ariza, bakim, kaza veya cekici ihtiyaci icin guided composer hazir.",
            statusLabel: maintenanceDue ? "Planli" : "Sessiz donem",
            statusTone: maintenanceDue ? "accent" : "info",
            cardRoute: maintenanceDue
              ? "/(modal)/talep/maintenance"
              : "/(modal)/talep/breakdown",
            primaryActionLabel: maintenanceDue
              ? "Bakim talebi olustur"
              : "Yeni talep baslat",
            primaryActionRoute: maintenanceDue
              ? "/(modal)/talep/maintenance"
              : "/(modal)/talep/breakdown",
            secondaryActionLabel: "Ustalari gor",
            secondaryActionRoute: "/(tabs)/carsi",
            metrics: [
              {
                value: `${activeVehicle?.mileageKm.toLocaleString("tr-TR") ?? 0} km`,
                label: "Kilometre",
              },
              {
                value: `${suggestions.length} aday`,
                label: "Hazir liste",
              },
              {
                value: activeVehicle?.healthLabel ?? "Sessiz",
                label: "Durum",
              },
            ],
            badges: [
              {
                id: "calm",
                label: "Mock workflow hazir",
                tone: "info",
              },
            ],
          };

      return mockDelay({
        decision,
        activeProcess: trackingView && activeCase
          ? {
              id: activeCase.id,
              servisAd: trackingView.serviceSummary?.name ?? "Servis secimi bekleniyor",
              title: activeCase.title,
              status: trackingView.header.statusLabel,
              waitLabel: trackingView.header.waitLabel,
              nextStepLabel: trackingView.header.nextLabel,
              note: trackingView.header.summaryDescription,
              progressLabel: `%${trackingView.progressValue} tamamlandi`,
              progressValue: trackingView.progressValue,
              priceLabel: trackingView.header.totalLabel ?? "Teklif bekleniyor",
              cardRoute: getCaseTrackingRoute(activeCase.id),
              primaryActionLabel: trackingView.primaryAction?.label,
              primaryActionRoute: trackingView.primaryAction?.route,
            }
          : null,
        taskQueue: trackingView && activeCase
          ? trackingView.notificationQueue.map((intent) => ({
              id: intent.id,
              title: intent.title,
              subtitle: intent.body,
              route: intent.route_hint ?? getCaseTrackingRoute(activeCase.id),
              tone: intent.type.includes("approval")
                ? "warning"
                : intent.type === "payment_review"
                  ? "critical"
                  : "info",
            }))
          : [],
        recentActivity:
          trackingView?.stages
            .map((stage) => ({
              id: stage.id,
              title: stage.title,
              subtitle: stage.evidencePreview[0]?.title ?? stage.subtitle,
              meta: stage.evidencePreview[0]?.meta ?? stage.timeLabel,
              tone: normalizeActivityTone(stageToneToBadgeTone(stage.state)),
            }))
            .slice(0, 4) ?? [],
        suggestions,
        campaigns: [...campaigns],
        nearbyServices: nearbyServices.map((service) => ({
          ...service,
          badges: [...service.badges],
        })),
      });
    },
  });
}
