import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  AppointmentRequestPayloadSchema,
  AppointmentResponseSchema,
  type AppointmentRequestPayload,
  type AppointmentResponse,
} from "./schemas";

/**
 * Appointment canonical wrappers — customer scope.
 * Teknisyen tarafı (approve/decline/counter-propose) service app.
 */

export function useCaseAppointments(caseId: string) {
  return useQuery<AppointmentResponse[]>({
    queryKey: ["appointments", "case", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/appointments/case/${caseId}`);
      return AppointmentResponseSchema.array().parse(raw);
    },
    staleTime: 15 * 1000,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation<AppointmentResponse, Error, AppointmentRequestPayload>({
    mutationFn: async (payload) => {
      const body = AppointmentRequestPayloadSchema.parse(payload);
      const raw = await apiClient(`/appointments`, {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return AppointmentResponseSchema.parse(raw);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: ["appointments", "case", response.case_id],
      });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

function createSimpleAction(
  action: "cancel" | "confirm-counter" | "decline-counter",
) {
  return function useAction(appointmentId: string, caseId: string) {
    const queryClient = useQueryClient();
    return useMutation<AppointmentResponse, Error, void>({
      mutationFn: async () => {
        const raw = await apiClient(
          `/appointments/${appointmentId}/${action}`,
          { method: "POST" },
        );
        return AppointmentResponseSchema.parse(raw);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["appointments", "case", caseId],
        });
        queryClient.invalidateQueries({ queryKey: ["cases"] });
      },
    });
  };
}

export const useCancelAppointment = createSimpleAction("cancel");
export const useConfirmCounter = createSimpleAction("confirm-counter");
export const useDeclineCounter = createSimpleAction("decline-counter");
