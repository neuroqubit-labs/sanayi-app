import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  CoveragePayloadSchema,
  CoverageSnapshotResponseSchema,
  type CoveragePayload,
  type CoverageSnapshotResponse,
} from "../coverage-schema";

export function useUpdateCoverageMutation() {
  const queryClient = useQueryClient();
  return useMutation<CoverageSnapshotResponse, Error, CoveragePayload>({
    mutationFn: async (payload) => {
      const body = CoveragePayloadSchema.parse(payload);
      const raw = await apiClient("/technicians/me/coverage", {
        method: "PUT",
        body,
      });
      return CoverageSnapshotResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "me"] });
      queryClient.invalidateQueries({ queryKey: ["shell-config"] });
    },
  });
}
