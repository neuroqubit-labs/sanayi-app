import type {
  CaseServiceSnapshot,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";

export const PRIMARY_TECHNICIAN_ID = "tech-autopro-servis";

export const trackingVehicleDirectory = {
  "veh-bmw-34-abc-42": {
    id: "veh-bmw-34-abc-42",
    plate: "34 ABC 42",
    vehicleLabel: "BMW 3 Serisi · 2019",
    brand: "BMW",
    model: "320i",
    year: 2019,
    color: "Lacivert",
    fuelType: "Benzin",
    vin: "WBAVB13596PT22381",
    kmLabel: "78.400 km",
    note: "Hasar dosyasi acik, parca karari yaklasiyor",
    customerName: "Alfonso Demir",
    previousCaseCount: 3,
    lastCaseLabel: "Zamanlama kiti · 2 ay önce",
  },
  "veh-toyota-06-xyz-77": {
    id: "veh-toyota-06-xyz-77",
    plate: "06 XYZ 77",
    vehicleLabel: "Toyota Corolla · 2021",
    brand: "Toyota",
    model: "Corolla",
    year: 2021,
    color: "Beyaz",
    fuelType: "Benzin",
    vin: "JTDEBRBE8MJ052117",
    kmLabel: "42.150 km",
    note: "Bakim periyodu yaklasti",
    customerName: "Deniz Kaya",
    previousCaseCount: 1,
    lastCaseLabel: "Periyodik bakım · 6 ay önce",
  },
  "veh-pool-34-xyz-01": {
    id: "veh-pool-34-xyz-01",
    plate: "34 XYZ 001",
    vehicleLabel: "Toyota Corolla · 2018",
    brand: "Toyota",
    model: "Corolla",
    year: 2018,
    color: "Gri",
    fuelType: "Dizel",
    vin: "JTDEBRBE7JJ214489",
    kmLabel: "142.000 km",
    note: "Havuzda aktif talep",
    customerName: "Mehmet Arslan",
    previousCaseCount: 0,
    lastCaseLabel: null,
  },
  "veh-pool-06-abc-02": {
    id: "veh-pool-06-abc-02",
    plate: "06 ACG 227",
    vehicleLabel: "Renault Clio · 2020",
    brand: "Renault",
    model: "Clio",
    year: 2020,
    color: "Kırmızı",
    fuelType: "Benzin",
    vin: "VF1RJA00263874521",
    kmLabel: "68.000 km",
    note: "Havuzda aktif talep",
    customerName: "Selin Yildiz",
    previousCaseCount: 2,
    lastCaseLabel: "Akü değişimi · 4 ay önce",
  },
  "veh-pool-34-def-03": {
    id: "veh-pool-34-def-03",
    plate: "34 DRJ 414",
    vehicleLabel: "BMW 320i · 2014",
    brand: "BMW",
    model: "320i",
    year: 2014,
    color: "Siyah",
    fuelType: "Dizel",
    vin: "WBA3B5C54EK138764",
    kmLabel: "268.000 km",
    note: "Yuksek km, revizyon",
    customerName: "Kaan Ozturk",
    previousCaseCount: 5,
    lastCaseLabel: "Turbo bakımı · 3 ay önce",
  },
  "veh-pool-34-ghi-04": {
    id: "veh-pool-34-ghi-04",
    plate: "34 ELF 618",
    vehicleLabel: "Mercedes C200 · 2021",
    brand: "Mercedes-Benz",
    model: "C200",
    year: 2021,
    color: "Gümüş",
    fuelType: "Benzin",
    vin: "WDDWF4HB3MR452913",
    kmLabel: "38.400 km",
    note: "Kasko aktif",
    customerName: "Elif Demirci",
    previousCaseCount: 0,
    lastCaseLabel: null,
  },
  "veh-pool-34-jkl-05": {
    id: "veh-pool-34-jkl-05",
    plate: "34 SPR 909",
    vehicleLabel: "Audi A4 · 2019",
    brand: "Audi",
    model: "A4",
    year: 2019,
    color: "Mavi",
    fuelType: "Benzin",
    vin: "WAUZZZ8K4KA019283",
    kmLabel: "82.300 km",
    note: "Sigorta dosyasi acildi",
    customerName: "Serkan Polat",
    previousCaseCount: 1,
    lastCaseLabel: "Fren balata · 8 ay önce",
  },
} as const;

export type TrackingVehicleMeta =
  (typeof trackingVehicleDirectory)[keyof typeof trackingVehicleDirectory];

export const trackingServiceDirectory = {
  "tech-autopro-servis": {
    id: "tech-autopro-servis",
    name: "AutoPro Servis",
    tagline: "Motor · Elektrik · BMW Uzmani",
    reason: "Bu vaka icin guclu eslesme",
    service_mode: "Atolye + pickup",
    guarantee: "6 ay / 10.000 km",
    rating_label: "4.8 · 127 yorum",
    response_label: "2 dk icinde cevap",
    distance_label: "2.1 km",
    badges: ["Dogrulandi", "Pickup", "BMW"],
  },
  "tech-engin-oto": {
    id: "tech-engin-oto",
    name: "Engin Oto Elektrik",
    tagline: "Elektrik · Teshis · Mobil Kontrol",
    reason: "Erken teshis hizi yuksek",
    service_mode: "Mobil kontrol + atolye",
    guarantee: "30 gun teshis",
    rating_label: "4.5 · 89 yorum",
    response_label: "4 dk icinde cevap",
    distance_label: "3.4 km",
    badges: ["Dogrulandi", "Hizli teklif", "Canli guncelleme"],
  },
  "tech-sariyer-motor": {
    id: "tech-sariyer-motor",
    name: "Sariyer Motor",
    tagline: "Motor · Revizyon · Turbo",
    reason: "Derin mekanik denetim guclu",
    service_mode: "Atolye",
    guarantee: "Parca bazli yazili garanti",
    rating_label: "4.7 · 214 yorum",
    response_label: "2 dk icinde cevap",
    distance_label: "6.1 km",
    badges: ["Dogrulandi", "OEM parca", "Fotograf kaniti"],
  },
} as const;

export type TrackingServiceMeta =
  (typeof trackingServiceDirectory)[keyof typeof trackingServiceDirectory];

export function getTrackingVehicleMeta(vehicleId: string | null | undefined) {
  if (!vehicleId) {
    return null;
  }

  return (
    trackingVehicleDirectory[
      vehicleId as keyof typeof trackingVehicleDirectory
    ] ?? null
  );
}

export function getTrackingServiceMeta(
  technicianId: string | null | undefined,
) {
  if (!technicianId) {
    return null;
  }

  return (
    trackingServiceDirectory[
      technicianId as keyof typeof trackingServiceDirectory
    ] ?? null
  );
}

export function getTrackingServiceSnapshot(
  technicianId: string | null | undefined,
  reasonOverride?: string,
): CaseServiceSnapshot | null {
  const profile = getTrackingServiceMeta(technicianId);

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    reason: reasonOverride ?? profile.reason,
    badges: [...profile.badges],
  };
}

export function getTrackingTechnicianName(
  technicianId: string | null | undefined,
) {
  return getTrackingServiceMeta(technicianId)?.name ?? null;
}

const DRAFT_DEFAULT_TAIL = {
  location_lat_lng: null,
  dropoff_lat_lng: null,
  counterparty_vehicle_count: null,
  report_method: null,
  kasko_selected: false,
  sigorta_selected: false,
  ambulance_contacted: false,
  emergency_acknowledged: false,
  breakdown_category: null,
  on_site_repair: false,
  price_preference: null,
  maintenance_category: null,
  towing_decision_made: false,
  tow_mode: null,
  tow_required_equipment: [],
  tow_incident_reason: null,
  tow_scheduled_at: null,
  tow_parent_case_id: null,
};

export function createTrackingDraftForKind(
  kind: ServiceRequestKind,
  vehicleId: string,
): ServiceRequestDraft {
  if (kind === "accident") {
    return {
      kind,
      vehicle_id: vehicleId,
      urgency: "urgent",
      summary: "",
      location_label: "",
      notes: "",
      attachments: [],
      symptoms: [],
      maintenance_items: [],
      preferred_window: undefined,
      vehicle_drivable: null,
      towing_required: false,
      pickup_preference: null,
      mileage_km: null,
      preferred_technician_id: null,
      counterparty_note: undefined,
      damage_area: undefined,
      valet_requested: false,
      ...DRAFT_DEFAULT_TAIL,
    };
  }

  if (kind === "towing") {
    return {
      kind,
      vehicle_id: vehicleId,
      urgency: "urgent",
      summary: "",
      location_label: "",
      dropoff_label: "",
      notes: "",
      attachments: [],
      symptoms: [],
      maintenance_items: [],
      preferred_window: undefined,
      vehicle_drivable: false,
      towing_required: true,
      pickup_preference: "pickup",
      mileage_km: null,
      preferred_technician_id: null,
      counterparty_note: undefined,
      damage_area: undefined,
      valet_requested: false,
      ...DRAFT_DEFAULT_TAIL,
      towing_decision_made: true,
      tow_mode: "immediate",
      tow_required_equipment: ["flatbed"],
      tow_incident_reason: "not_running",
    };
  }

  if (kind === "maintenance") {
    return {
      kind,
      vehicle_id: vehicleId,
      urgency: "planned",
      summary: "",
      location_label: "",
      notes: "",
      attachments: [],
      symptoms: [],
      maintenance_items: [],
      preferred_window: undefined,
      vehicle_drivable: true,
      towing_required: false,
      pickup_preference: null,
      mileage_km: null,
      preferred_technician_id: null,
      counterparty_note: undefined,
      damage_area: undefined,
      valet_requested: false,
      ...DRAFT_DEFAULT_TAIL,
    };
  }

  return {
    kind,
    vehicle_id: vehicleId,
    urgency: "today",
    summary: "",
    location_label: "",
    notes: "",
    attachments: [],
    symptoms: [],
    maintenance_items: [],
    preferred_window: undefined,
    vehicle_drivable: true,
    towing_required: false,
    pickup_preference: null,
    mileage_km: null,
    preferred_technician_id: null,
    counterparty_note: undefined,
    damage_area: undefined,
    valet_requested: false,
    ...DRAFT_DEFAULT_TAIL,
  };
}
