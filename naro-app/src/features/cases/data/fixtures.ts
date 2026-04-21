import type {
  CaseServiceSnapshot,
  ServiceCase,
  ServiceCaseStatus,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import {
  createTrackingDraftForKind,
  getTrackingServiceSnapshot,
  getTrackingStatusLabel,
  getTrackingTechnicianName,
  seedTrackingCases,
} from "@naro/mobile-core";

export const CASE_CAMPAIGNS = {
  "veh-bmw-34-abc-42": [
    {
      id: "campaign-1",
      title: "Yaz Bakimi Paketi",
      subtitle: "Yag + filtre + klima kontrolu",
      priceLabel: "₺699",
      route: "/(modal)/talep/maintenance",
      categoryLabel: "Bakım paketi",
      deadlineLabel: "Cumaya kadar geçerli",
      fineprint: "KDV dahil · pickup ücretsiz",
    },
    {
      id: "campaign-2",
      title: "Lastik Degisim Kampanyasi",
      subtitle: "4 lastik montaj + balans",
      priceLabel: "₺999",
      route: "/(modal)/talep/maintenance",
      categoryLabel: "Lastik",
      fineprint: "4 lastik + balans · hurda lastik geri alım",
    },
  ],
  "veh-toyota-06-xyz-77": [
    {
      id: "campaign-3",
      title: "Bahar Kontrol Paketi",
      subtitle: "Genel mekanik ve aku taramasi",
      priceLabel: "₺540",
      route: "/(modal)/talep/maintenance",
      categoryLabel: "Bakım paketi",
      fineprint: "Rapor dijital olarak gönderilir",
    },
  ],
} as const;

export const CASE_NEARBY_SERVICES = {
  "veh-bmw-34-abc-42": [
    {
      id: "tech-autopro-servis",
      name: "AutoPro Servis",
      distanceLabel: "2.1 km",
      ratingLabel: "4.8 · 127 yorum",
      badges: ["Pickup", "BMW", "Dogrulandi"],
      route: "/usta/tech-autopro-servis",
    },
    {
      id: "tech-engin-oto",
      name: "Engin Oto Elektrik",
      distanceLabel: "3.4 km",
      ratingLabel: "4.5 · 89 yorum",
      badges: ["Mobil kontrol", "Hizli teklif"],
      route: "/usta/tech-engin-oto",
    },
  ],
  "veh-toyota-06-xyz-77": [
    {
      id: "tech-autopro-servis",
      name: "AutoPro Servis",
      distanceLabel: "2.1 km",
      ratingLabel: "4.8 · 127 yorum",
      badges: ["Vale", "Bakim", "Dogrulandi"],
      route: "/usta/tech-autopro-servis",
    },
  ],
} as const;

export function createDraftForKind(
  kind: ServiceRequestKind,
  vehicleId: string,
): ServiceRequestDraft {
  return createTrackingDraftForKind(kind, vehicleId);
}

export function getServiceSnapshot(
  technicianId: string | null | undefined,
  reasonOverride?: string,
): CaseServiceSnapshot | null {
  return getTrackingServiceSnapshot(technicianId, reasonOverride);
}

export function seedCases(): ServiceCase[] {
  return seedTrackingCases();
}

export function getStatusPresentation(status: ServiceCaseStatus) {
  const label = getTrackingStatusLabel(status);

  return {
    subtitle: label,
    nextActionTitle: label,
    nextActionDescription: label,
    nextActionPrimaryLabel: label,
    nextActionSecondaryLabel: null,
  };
}

export function getTechnicianName(technicianId: string | null | undefined) {
  return getTrackingTechnicianName(technicianId);
}
