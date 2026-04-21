import type { TowTechnicianProfile, TowVehicleEquipment } from "@naro/domain";

export type TowTechnicianSeed = TowTechnicianProfile & {
  start_lat_lng: { lat: number; lng: number };
  avg_speed_kmh: number;
};

export const TOW_TECHNICIAN_POOL: TowTechnicianSeed[] = [
  {
    id: "tow-tech-demir",
    name: "Demir Yardım Çekici",
    rating: 4.9,
    completed_jobs: 1280,
    plate: "34 DMR 48",
    truck_model: "Ford Transit flatbed",
    equipment: "flatbed",
    phone: "+905321112233",
    photo_url: null,
    start_lat_lng: { lat: 41.0521, lng: 28.9867 },
    avg_speed_kmh: 40,
  },
  {
    id: "tow-tech-ilkay",
    name: "İlkay Ağır Vasıta",
    rating: 4.8,
    completed_jobs: 960,
    plate: "34 ILK 07",
    truck_model: "Iveco Daily wheel-lift",
    equipment: "wheel_lift",
    phone: "+905351117788",
    photo_url: null,
    start_lat_lng: { lat: 41.0402, lng: 29.0053 },
    avg_speed_kmh: 38,
  },
  {
    id: "tow-tech-saim",
    name: "Saim Hook Çekici",
    rating: 4.6,
    completed_jobs: 420,
    plate: "34 SM 914",
    truck_model: "Mitsubishi Canter hook",
    equipment: "hook",
    phone: "+905331002244",
    photo_url: null,
    start_lat_lng: { lat: 41.0285, lng: 28.9742 },
    avg_speed_kmh: 42,
  },
  {
    id: "tow-tech-ege",
    name: "Ege Lüks Flatbed",
    rating: 4.95,
    completed_jobs: 2100,
    plate: "34 EGE 22",
    truck_model: "Mercedes Atego flatbed",
    equipment: "flatbed",
    phone: "+905441667788",
    photo_url: null,
    start_lat_lng: { lat: 41.0631, lng: 29.0193 },
    avg_speed_kmh: 36,
  },
  {
    id: "tow-tech-bora",
    name: "Bora Ağır Tır Kurtarıcı",
    rating: 4.7,
    completed_jobs: 540,
    plate: "34 BRA 55",
    truck_model: "MAN TGS heavy-duty",
    equipment: "heavy_duty",
    phone: "+905552211998",
    photo_url: null,
    start_lat_lng: { lat: 41.0745, lng: 28.9945 },
    avg_speed_kmh: 30,
  },
];

export function selectBestTechnicianForEquipment(
  equipment: TowVehicleEquipment,
): TowTechnicianSeed {
  const exact = TOW_TECHNICIAN_POOL.filter((t) => t.equipment === equipment);
  if (exact.length > 0) return exact[0]!;
  return TOW_TECHNICIAN_POOL[0]!;
}
