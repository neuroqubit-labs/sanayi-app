import type { ServiceArea } from "@naro/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

/**
 * BE canonical PUT /technicians/me/service-area — api-validation-hotlist
 * P1-3 launch migration 2026-04-23. 204 No Content.
 *
 * Domain → BE payload shape mapping:
 * - workshop_lat_lng: LatLng → workshop_lat + workshop_lng (flat Decimal)
 * - working_districts: DistrictRef[] → string[] (ID listesi)
 * - city_code: nullable → zorunlu (BE extra=forbid + min_length=1)
 */
type ServiceAreaPayload = {
  workshop_lat: number;
  workshop_lng: number;
  service_radius_km: number;
  city_code: string;
  primary_district_id: string | null;
  working_districts: string[];
  mobile_unit_count: number;
  workshop_address: string | null;
};

function serviceAreaToPayload(area: ServiceArea): ServiceAreaPayload {
  if (!area.workshop_lat_lng) {
    throw new Error("Atölye konumu seçilmeli (workshop_lat_lng null).");
  }
  if (!area.city_code) {
    throw new Error("İl seçilmeli (city_code null).");
  }
  return {
    workshop_lat: area.workshop_lat_lng.lat,
    workshop_lng: area.workshop_lat_lng.lng,
    service_radius_km: area.service_radius_km,
    city_code: area.city_code,
    primary_district_id: area.primary_district_id,
    working_districts: area.working_districts.map((d) => d.id),
    mobile_unit_count: area.mobile_unit_count,
    workshop_address: area.workshop_address,
  };
}

export function useUpdateServiceAreaMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ServiceArea>({
    mutationFn: async (area) => {
      const payload = serviceAreaToPayload(area);
      await apiClient(`/technicians/me/service-area`, {
        method: "PUT",
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
      queryClient.invalidateQueries({ queryKey: ["shell-config"] });
    },
  });
}
