import { useQuery } from "@tanstack/react-query";

import { useActiveCase } from "@/features/cases";
import { useActiveVehicle } from "@/features/vehicles";
import { mockDelay } from "@/shared/lib/mock";

import {
  mockTechnicianMatchesByVehicle,
  mockTechnicianProfiles,
} from "./data/fixtures";
import type { TechnicianMatch, TechnicianProfile } from "./types";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";
const DEFAULT_MATCHES =
  mockTechnicianMatchesByVehicle[DEFAULT_VEHICLE_ID] ?? [];

export function useTechnicianMatches() {
  const { data: activeVehicle } = useActiveVehicle();
  const { data: activeCase } = useActiveCase();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useQuery<TechnicianMatch[]>({
    queryKey: ["technicians", "matches", vehicleId, activeCase?.id],
    queryFn: async () => {
      const matches =
        mockTechnicianMatchesByVehicle[vehicleId] ?? DEFAULT_MATCHES;

      if (!activeCase) {
        return mockDelay(matches);
      }

      const enriched: TechnicianMatch[] = matches.map((technician) => {
        const relatedOffer = activeCase.offers.find(
          (offer) => offer.technician_id === technician.id,
        );

        if (!relatedOffer) {
          return technician;
        }

        return {
          ...technician,
          reason:
            relatedOffer.status === "accepted"
              ? "Bu vakada secilen servis"
              : relatedOffer.status === "shortlisted"
                ? "Bu vaka icin shortlist'te"
                : "Bu vaka icin teklif verdi",
          availabilityLabel:
            relatedOffer.status === "accepted"
              ? "Aktif vaka"
              : technician.availabilityLabel,
          badges: [
            ...technician.badges,
            {
              id: `case-${activeCase.id}`,
              label: "Aktif vakada",
              tone: relatedOffer.status === "accepted" ? "success" : "info",
            },
          ],
        };
      });

      return mockDelay(enriched);
    },
  });
}

export function useTechnicianProfile(technicianId: string) {
  return useQuery<TechnicianProfile | null>({
    queryKey: ["technicians", "profile", technicianId],
    queryFn: () =>
      mockDelay(
        mockTechnicianProfiles.find(
          (technician) => technician.id === technicianId,
        ) ?? null,
      ),
  });
}
