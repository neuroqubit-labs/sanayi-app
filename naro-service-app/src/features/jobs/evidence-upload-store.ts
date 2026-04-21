import { create } from "zustand";

type EvidenceUploadState = {
  caseId: string | null;
  taskId: string | null;
  open: (input: { caseId: string; taskId?: string }) => void;
  close: () => void;
};

export const useEvidenceUploadStore = create<EvidenceUploadState>((set) => ({
  caseId: null,
  taskId: null,
  open: ({ caseId, taskId }) => set({ caseId, taskId: taskId ?? null }),
  close: () => set({ caseId: null, taskId: null }),
}));
