import { useMutation, useQuery } from "@tanstack/react-query";

import { mockDelay } from "@/shared/lib/mock";
import { queryClient } from "@/shared/lib/query";

import { useVehicleStore } from "./store";
import type { Vehicle, VehicleDraft } from "./types";

function withActiveFlag(vehicles: Vehicle[], activeId: string): Vehicle[] {
  return vehicles.map((vehicle) => ({
    ...vehicle,
    isActive: vehicle.id === activeId,
  }));
}

export function useVehicles() {
  const activeVehicleId = useVehicleStore((state) => state.activeVehicleId);
  const vehicles = useVehicleStore((state) => state.vehicles);

  return useQuery<Vehicle[]>({
    queryKey: ["vehicles", activeVehicleId, vehicles.length],
    queryFn: () => mockDelay(withActiveFlag(vehicles, activeVehicleId)),
    initialData: withActiveFlag(vehicles, activeVehicleId),
  });
}

export function useActiveVehicle() {
  const activeVehicleId = useVehicleStore((state) => state.activeVehicleId);
  const vehicles = useVehicleStore((state) => state.vehicles);

  return useQuery<Vehicle | null>({
    queryKey: ["vehicles", "active", activeVehicleId, vehicles.length],
    queryFn: () =>
      mockDelay(
        vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? null,
      ),
    initialData:
      vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? null,
  });
}

export function useVehicle(vehicleId: string) {
  const activeVehicleId = useVehicleStore((state) => state.activeVehicleId);
  const vehicles = useVehicleStore((state) => state.vehicles);

  return useQuery<Vehicle | null>({
    queryKey: ["vehicles", vehicleId, activeVehicleId, vehicles.length],
    queryFn: () =>
      mockDelay(
        vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
      ),
    initialData: vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
  });
}

export function useAddVehicle() {
  return useMutation({
    mutationFn: async (draft: VehicleDraft) => {
      const vehicle = useVehicleStore.getState().addVehicle(draft);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      return vehicle;
    },
  });
}
