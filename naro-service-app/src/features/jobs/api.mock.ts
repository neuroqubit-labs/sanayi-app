import type { CaseAttachment, ServiceCase } from "@naro/domain";
import {
  buildTechnicianTrackingView,
  PRIMARY_TECHNICIAN_ID,
  type DeliveryReportPayload,
  type OfferSubmissionPayload,
} from "@naro/mobile-core";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useTechnicianProfileStore } from "@/features/technicians";
import { mockDelay } from "@/shared/lib/mock";
import { queryClient } from "@/shared/lib/query";

import {
  isAvailableInPool,
  isRelevantToTechnician,
  useJobsStore,
} from "./store.mock";

function sortCases(cases: ServiceCase[]) {
  return [...cases].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

async function invalidateJobConsumers() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["pool"] }),
    queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    queryClient.invalidateQueries({ queryKey: ["business"] }),
  ]);
}

export function useJobsFeed() {
  return useQuery<ServiceCase[]>({
    queryKey: ["jobs", "feed"],
    queryFn: () =>
      mockDelay(
        sortCases(
          useJobsStore
            .getState()
            .cases.filter((caseItem) =>
              isRelevantToTechnician(caseItem, PRIMARY_TECHNICIAN_ID),
            ),
        ),
      ),
  });
}

export function useCasePool() {
  const providerType = useTechnicianProfileStore((state) => state.provider_type);
  return useQuery<ServiceCase[]>({
    queryKey: ["pool", "feed", providerType],
    queryFn: () =>
      mockDelay(
        sortCases(
          useJobsStore
            .getState()
            .cases.filter((caseItem) =>
              isAvailableInPool(
                caseItem,
                PRIMARY_TECHNICIAN_ID,
                providerType,
              ),
            ),
        ),
      ),
  });
}

export function usePoolCaseDetail(caseId: string) {
  return useQuery<ServiceCase | null>({
    queryKey: ["pool", "detail", caseId],
    queryFn: () =>
      mockDelay(
        useJobsStore
          .getState()
          .cases.find((caseItem) => caseItem.id === caseId) ?? null,
      ),
  });
}

export function useJobThread(caseId: string) {
  return useQuery({
    queryKey: ["jobs", "thread", caseId],
    queryFn: async () => {
      const caseItem = useJobsStore
        .getState()
        .cases.find((entry) => entry.id === caseId);
      return mockDelay(caseItem?.thread ?? null);
    },
  });
}

export function useIncomingAppointments() {
  return useQuery<ServiceCase[]>({
    queryKey: ["appointments", "incoming"],
    queryFn: () =>
      mockDelay(
        useJobsStore
          .getState()
          .cases.filter(
            (caseItem) =>
              caseItem.appointment?.status === "pending" &&
              caseItem.appointment.technician_id === PRIMARY_TECHNICIAN_ID,
          ),
      ),
  });
}

export function useJobDetail(caseId: string) {
  return useQuery<ServiceCase | null>({
    queryKey: ["jobs", "detail", caseId],
    queryFn: () =>
      mockDelay(
        useJobsStore.getState().cases.find((caseItem) => caseItem.id === caseId) ??
          null,
      ),
  });
}

export function useTechnicianTrackingJob(caseId: string) {
  return useQuery({
    queryKey: ["jobs", "tracking-view", caseId],
    queryFn: async () => {
      const caseItem = useJobsStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(caseItem ? buildTechnicianTrackingView(caseItem) : null);
    },
  });
}

export function useJobTask(caseId: string, taskId: string) {
  return useQuery({
    queryKey: ["jobs", "task", caseId, taskId],
    queryFn: async () => {
      const caseItem = useJobsStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(
        caseItem?.tasks.find((task) => task.id === taskId) ?? null,
      );
    },
  });
}

export function useMarkJobSeen(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useJobsStore.getState().markSeen(caseId);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useAddJobEvidence(caseId: string) {
  return useMutation({
    mutationFn: async ({
      taskId,
      attachment,
      note,
    }: {
      taskId: string;
      attachment: CaseAttachment;
      note?: string;
    }) => {
      const updatedCase = useJobsStore
        .getState()
        .addEvidence(caseId, taskId, attachment, note);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useShareJobStatusUpdate(caseId: string) {
  return useMutation({
    mutationFn: async (note: string) => {
      const updatedCase = useJobsStore.getState().shareStatusUpdate(caseId, note);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useRequestJobPartsApproval(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useJobsStore.getState().requestPartsApproval(caseId);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useShareJobInvoice(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useJobsStore.getState().shareInvoice(caseId);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useMarkReadyForDelivery(caseId: string) {
  return useMutation({
    mutationFn: async (report?: DeliveryReportPayload) => {
      const updatedCase = useJobsStore
        .getState()
        .markReadyForDelivery(caseId, report);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useSendJobMessage(caseId: string) {
  return useMutation({
    mutationFn: async (body: string) => {
      const updatedCase = useJobsStore.getState().sendMessage(caseId, body);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useSubmitOffer() {
  return useMutation({
    mutationFn: async (input: {
      caseId: string;
      payload: OfferSubmissionPayload;
    }) => {
      const updatedCase = useJobsStore
        .getState()
        .submitOffer(input.caseId, input.payload);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useApproveIncomingAppointment() {
  return useMutation({
    mutationFn: async (caseId: string) => {
      const updatedCase = useJobsStore.getState().approveAppointment(caseId);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}

export function useDeclineIncomingAppointment() {
  return useMutation({
    mutationFn: async (input: { caseId: string; reason?: string }) => {
      const updatedCase = useJobsStore
        .getState()
        .declineAppointment(input.caseId, input.reason);
      await invalidateJobConsumers();
      return updatedCase;
    },
  });
}
