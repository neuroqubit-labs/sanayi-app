import type { Vehicle } from "../types";

export const mockVehicles: Vehicle[] = [
  {
    id: "veh-1",
    plate: "34 ABC 42",
    make: "BMW",
    model: "3 Serisi",
    year: 2019,
    color: "Beyaz",
    isActive: true,
  },
  {
    id: "veh-2",
    plate: "06 XYZ 88",
    make: "Volkswagen",
    model: "Polo",
    year: 2021,
    color: "Gri",
    isActive: false,
  },
];
