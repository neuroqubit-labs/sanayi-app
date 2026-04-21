import type {
  CaseAttachment,
  ServiceCase,
  ServiceRequestDraft,
  ServiceRequestKind,
} from "@naro/domain";
import { buildCustomerTrackingView } from "@naro/mobile-core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { pushNotification } from "@/features/notifications/api";
import { mockTechnicianProfiles } from "@/features/ustalar/data/fixtures";
import { useActiveVehicle } from "@/features/vehicles";
import type { Vehicle } from "@/features/vehicles/types";
import { mockDelay } from "@/shared/lib/mock";
import { queryClient } from "@/shared/lib/query";

import { useTechnicianCooldownStore } from "./cooldown-store";
import { createDraftForKind } from "./data/fixtures";
import { useCasesStore } from "./store";

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";

function sortCases(cases: ServiceCase[]) {
  return [...cases].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

function isActiveCase(caseItem: ServiceCase) {
  return !["completed", "archived", "cancelled"].includes(caseItem.status);
}

async function invalidateCaseConsumers() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
    queryClient.invalidateQueries({ queryKey: ["home"] }),
    queryClient.invalidateQueries({ queryKey: ["records"] }),
    queryClient.invalidateQueries({ queryKey: ["technicians"] }),
  ]);
}

export function getSuggestedRequestKindForVehicle(vehicle: Vehicle | null) {
  if (!vehicle) {
    return "breakdown" as ServiceRequestKind;
  }

  if (vehicle.note?.toLowerCase().includes("bakim")) {
    return "maintenance" as ServiceRequestKind;
  }

  return "breakdown" as ServiceRequestKind;
}

export function prefillDraftForTechnician(
  kind: ServiceRequestKind,
  technicianId: string,
  vehicleId: string,
) {
  useCasesStore
    .getState()
    .prefillDraftTechnician(kind, vehicleId, technicianId);
  void invalidateCaseConsumers();
}

export function attachTechnicianToCase(caseId: string, technicianId: string) {
  useCasesStore.getState().attachTechnician(caseId, technicianId);
  void invalidateCaseConsumers();
}

export function useCasesFeed() {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useQuery<ServiceCase[]>({
    queryKey: ["cases", "feed", vehicleId],
    queryFn: () => {
      const cases = useCasesStore
        .getState()
        .cases.filter((caseItem) => caseItem.vehicle_id === vehicleId);

      return mockDelay(sortCases(cases));
    },
  });
}

export function useActiveCase() {
  const { data } = useCasesFeed();

  return {
    data: data?.find(isActiveCase) ?? null,
  };
}

export function useCaseDetail(caseId: string) {
  return useQuery<ServiceCase | null>({
    queryKey: ["cases", "detail", caseId],
    queryFn: () =>
      mockDelay(
        useCasesStore
          .getState()
          .cases.find((caseItem) => caseItem.id === caseId) ?? null,
      ),
  });
}

export function useCustomerTrackingView(caseId: string) {
  return useQuery({
    queryKey: ["cases", "tracking-view", caseId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(caseItem ? buildCustomerTrackingView(caseItem) : null);
    },
  });
}

export function useCaseTask(caseId: string, taskId: string) {
  return useQuery({
    queryKey: ["cases", "task", caseId, taskId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(
        caseItem?.tasks.find((task) => task.id === taskId) ?? null,
      );
    },
  });
}

export function useCaseOffers(caseId: string) {
  return useQuery({
    queryKey: ["cases", "offers", caseId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(caseItem?.offers ?? []);
    },
  });
}

export function useCaseThread(caseId: string) {
  return useQuery({
    queryKey: ["cases", "thread", caseId],
    queryFn: async () => {
      const caseItem = useCasesStore
        .getState()
        .cases.find((entry) => entry.id === caseId);

      return mockDelay(caseItem?.thread ?? null);
    },
  });
}

export function useCreateCaseDraft(kind: ServiceRequestKind) {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  const query = useQuery<ServiceRequestDraft>({
    queryKey: ["cases", "draft", kind, vehicleId],
    queryFn: async () => {
      const draft = useCasesStore.getState().getDraft(kind, vehicleId);
      return mockDelay(draft);
    },
    initialData: createDraftForKind(kind, vehicleId),
  });

  return {
    ...query,
    updateDraft: (patch: Partial<ServiceRequestDraft>) => {
      const draft = useCasesStore.getState().updateDraft(kind, patch);
      void queryClient.invalidateQueries({
        queryKey: ["cases", "draft", kind, vehicleId],
      });
      return draft;
    },
    resetDraft: () => {
      const draft = useCasesStore.getState().resetDraft(kind, vehicleId);
      void queryClient.invalidateQueries({
        queryKey: ["cases", "draft", kind, vehicleId],
      });
      return draft;
    },
  };
}

export function useSubmitCase(kind: ServiceRequestKind) {
  const { data: activeVehicle } = useActiveVehicle();
  const vehicleId = activeVehicle?.id ?? DEFAULT_VEHICLE_ID;

  return useMutation({
    mutationFn: async () => {
      const createdCase = useCasesStore.getState().submitDraft(kind, vehicleId);
      await invalidateCaseConsumers();
      return createdCase;
    },
  });
}

export function useRefreshCaseMatching(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().refreshMatching(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useSelectCaseOffer(caseId: string) {
  return useMutation({
    mutationFn: async (offerId: string) => {
      const updatedCase = useCasesStore.getState().selectOffer(caseId, offerId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useShortlistCaseOffer(caseId: string) {
  return useMutation({
    mutationFn: async (offerId: string) => {
      const updatedCase = useCasesStore
        .getState()
        .shortlistOffer(caseId, offerId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useRejectCaseOffer(caseId: string) {
  return useMutation({
    mutationFn: async (offerId: string) => {
      const updatedCase = useCasesStore.getState().rejectOffer(caseId, offerId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useConfirmAppointment(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().confirmAppointment(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

const MOCK_RESPONSE_DELAY_MS = 8000;
const MOCK_APPROVE_RATE = 0.9;

function scheduleMockAppointmentResponse(caseId: string, technicianId: string) {
  const technician = mockTechnicianProfiles.find((t) => t.id === technicianId);
  const technicianName = technician?.name ?? "Usta";
  setTimeout(() => {
    const current = useCasesStore
      .getState()
      .cases.find((item) => item.id === caseId);
    if (!current || current.status !== "appointment_pending") {
      return;
    }
    const shouldApprove = Math.random() < MOCK_APPROVE_RATE;
    if (shouldApprove) {
      useCasesStore.getState().approveAppointment(caseId);
      pushNotification({
        kind: "case_status",
        title: `Randevu onaylandı — ${technicianName}`,
        body: "Süreç başladı. Hazırlıkları görmek için vakaya dokun.",
        route: `/vaka/${caseId}/surec`,
      });
    } else {
      useCasesStore
        .getState()
        .declineAppointment(caseId, "Planlarım son dakikada değişti");
      useTechnicianCooldownStore.getState().registerDecline(technicianId);
      pushNotification({
        kind: "case_status",
        title: `Randevu reddedildi — ${technicianName}`,
        body: "Usta şu an uygun değil. Alternatif önerilere bakabilirsin.",
        route: `/vaka/${caseId}/surec`,
      });
    }
    void invalidateCaseConsumers();
  }, MOCK_RESPONSE_DELAY_MS);
}

export function useRequestAppointment() {
  return useMutation({
    mutationFn: async (input: {
      caseId: string;
      payload: import("@naro/mobile-core").AppointmentRequestPayload;
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .requestAppointment(input.caseId, input.payload);
      await invalidateCaseConsumers();
      if (updatedCase) {
        scheduleMockAppointmentResponse(
          updatedCase.id,
          input.payload.technician_id,
        );
      }
      return updatedCase;
    },
  });
}

export function useCancelAppointment(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().cancelAppointment(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useCancelCase() {
  return useMutation({
    mutationFn: async (input: { caseId: string; reason?: string }) => {
      const updatedCase = useCasesStore
        .getState()
        .cancelCase(input.caseId, input.reason);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useAddCaseAttachment() {
  return useMutation({
    mutationFn: async (input: {
      caseId: string;
      attachment: CaseAttachment;
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .addAttachment(input.caseId, input.attachment);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useUpdateCaseNotes() {
  return useMutation({
    mutationFn: async (input: {
      caseId: string;
      summary?: string;
      notes?: string;
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .updateNotes(input.caseId, {
          summary: input.summary,
          notes: input.notes,
        });
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useApproveAppointmentMock(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().approveAppointment(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useDeclineAppointmentMock(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore
        .getState()
        .declineAppointment(caseId, "Planlarım değişti");
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useActiveAppointmentRequestsCount() {
  const { data } = useCasesFeed();
  return (data ?? []).filter(
    (caseItem) =>
      caseItem.status === "appointment_pending" &&
      caseItem.appointment?.status === "pending",
  ).length;
}

export function useAppointmentCountdown(caseId: string) {
  const { data: caseItem } = useCaseDetail(caseId);
  const appointment = caseItem?.appointment ?? null;
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!appointment || appointment.status !== "pending") {
      return;
    }
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [appointment]);

  if (!appointment || appointment.status !== "pending") {
    return { label: null as string | null, expired: false };
  }

  const remainingMs = new Date(appointment.expires_at).getTime() - nowTs;
  if (remainingMs <= 0) {
    return { label: "Süre doldu", expired: true };
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return { label: `${hours} sa ${minutes} dk kaldı`, expired: false };
  }
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  return { label: `${minutes} dk ${seconds} sn kaldı`, expired: false };
}

export function useApprovePartsRequest(caseId: string) {
  return useMutation({
    mutationFn: async (approvalId: string) => {
      const updatedCase = useCasesStore
        .getState()
        .approvePartsRequest(caseId, approvalId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useApproveInvoice(caseId: string) {
  return useMutation({
    mutationFn: async (approvalId: string) => {
      const updatedCase = useCasesStore
        .getState()
        .approveInvoice(caseId, approvalId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useConfirmCompletion(caseId: string) {
  return useMutation({
    mutationFn: async (approvalId: string) => {
      const updatedCase = useCasesStore
        .getState()
        .confirmCompletion(caseId, approvalId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useSendCaseMessage(caseId: string) {
  return useMutation({
    mutationFn: async ({
      body,
      attachments = [],
    }: {
      body: string;
      attachments?: CaseAttachment[];
    }) => {
      const updatedCase = useCasesStore
        .getState()
        .sendMessage(caseId, body, attachments);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export function useMarkCaseSeen(caseId: string) {
  return useMutation({
    mutationFn: async () => {
      const updatedCase = useCasesStore.getState().markSeen(caseId);
      await invalidateCaseConsumers();
      return updatedCase;
    },
  });
}

export type TechnicianActionMode =
  | "request_appointment"
  | "start_case"
  | "open_case"
  | "attach_case"
  | "unavailable_busy"
  | "unavailable_offline"
  | "unavailable_cooldown";

export type TechnicianCaseAction = {
  mode: TechnicianActionMode;
  primaryLabel: string;
  primaryRoute: string;
  disabled: boolean;
  helperText?: string;
  secondaryLabel?: string;
  secondaryRoute?: string;
  attachOnPrimary: boolean;
  prefillOnPrimary: boolean;
  description: string;
  kind: ServiceRequestKind;
  caseId: string | null;
  offerId: string | null;
};

export function useTechnicianCaseAction(
  technicianId: string,
): TechnicianCaseAction {
  const { data: activeVehicle } = useActiveVehicle();
  const { data: activeCase } = useActiveCase();
  const isInCooldown = useTechnicianCooldownStore((state) =>
    technicianId ? state.isInCooldown(technicianId) : false,
  );

  const kind = getSuggestedRequestKindForVehicle(activeVehicle ?? null);
  const technician = mockTechnicianProfiles.find((t) => t.id === technicianId);
  const availability = technician?.availability ?? "available";

  const isAttached = Boolean(
    activeCase &&
    (activeCase.preferred_technician_id === technicianId ||
      activeCase.assigned_technician_id === technicianId),
  );

  if (activeCase && isAttached) {
    return {
      mode: "open_case",
      primaryLabel: "Randevu Al",
      primaryRoute: `/randevu/${technicianId}?caseId=${activeCase.id}`,
      disabled: false,
      secondaryLabel: "Mesaj",
      secondaryRoute: `/vaka/${activeCase.id}/mesajlar`,
      attachOnPrimary: false,
      prefillOnPrimary: false,
      description: "Bu servis aktif vakada.",
      kind,
      caseId: activeCase.id,
      offerId: null,
    };
  }

  if (activeCase) {
    if (isInCooldown) {
      return {
        mode: "unavailable_cooldown",
        primaryLabel: "Kısa süre sonra tekrar dene",
        primaryRoute: "",
        disabled: true,
        helperText: "Bu usta son 24 saatte müsait değildi.",
        attachOnPrimary: false,
        prefillOnPrimary: false,
        description: "Cooldown aktif.",
        kind,
        caseId: activeCase.id,
        offerId: null,
      };
    }

    if (availability === "offline") {
      return {
        mode: "unavailable_offline",
        primaryLabel: "Çevrimdışı",
        primaryRoute: "",
        disabled: true,
        helperText: "Usta şu an çevrimdışı.",
        attachOnPrimary: false,
        prefillOnPrimary: false,
        description: "Usta çevrimdışı.",
        kind,
        caseId: activeCase.id,
        offerId: null,
      };
    }

    if (availability === "busy") {
      return {
        mode: "unavailable_busy",
        primaryLabel: "Şu an müsait değil",
        primaryRoute: "",
        disabled: true,
        helperText: "Müsait olduğunda bildirim isteyebilirsin.",
        attachOnPrimary: false,
        prefillOnPrimary: false,
        description: "Usta şu an müsait değil.",
        kind,
        caseId: activeCase.id,
        offerId: null,
      };
    }

    const route = `/randevu/${technicianId}?caseId=${activeCase.id}`;
    return {
      mode: "request_appointment",
      primaryLabel: "Randevu Al",
      primaryRoute: route,
      disabled: false,
      attachOnPrimary: true,
      prefillOnPrimary: false,
      description: "Bu usta ile randevu talebi aç.",
      kind,
      caseId: activeCase.id,
      offerId: null,
    };
  }

  return {
    mode: "start_case",
    primaryLabel: "Vaka Aç",
    primaryRoute: `/(modal)/usta-vaka/${technicianId}`,
    disabled: false,
    helperText: "Randevu için önce bakım, arıza ya da kaza vakası açılır.",
    attachOnPrimary: false,
    prefillOnPrimary: false,
    description:
      "Önce bu servise uygun bir vaka aç, sonra randevu adımına geç.",
    kind,
    caseId: null,
    offerId: null,
  };
}
