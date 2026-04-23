import type { WeeklySchedule } from "@naro/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

/**
 * BE canonical PUT /technicians/me/schedule — api-validation-hotlist P1-3.
 * 204 No Content.
 *
 * BE ScheduleSlotPayload alanları aynı (weekday 0-6, open_time/close_time
 * HH:MM, is_closed, slot_order); domain WeeklySchedule.slots[] birebir
 * gönderilir.
 */
export function useUpdateScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, WeeklySchedule>({
    mutationFn: async (schedule) => {
      await apiClient(`/technicians/me/schedule`, {
        method: "PUT",
        body: { slots: schedule.slots },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
    },
  });
}
