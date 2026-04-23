import type { StaffCapacity } from "@naro/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

/**
 * BE canonical PATCH /technicians/me/capacity — api-validation-hotlist P1-3.
 * 204 No Content.
 *
 * BE CapacityPayload: staff_count, max_concurrent_jobs, night/weekend/
 * emergency_service. Domain `current_queue_depth` BE'de yok; payload'dan
 * çıkarılır (extra=forbid 422 olmasın).
 */
export function useUpdateCapacityMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, StaffCapacity>({
    mutationFn: async (capacity) => {
      const payload = {
        staff_count: capacity.staff_count,
        max_concurrent_jobs: capacity.max_concurrent_jobs,
        night_service: capacity.night_service,
        weekend_service: capacity.weekend_service,
        emergency_service: capacity.emergency_service,
      };
      await apiClient(`/technicians/me/capacity`, {
        method: "PATCH",
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
    },
  });
}
