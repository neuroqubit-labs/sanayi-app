import {
  CaseDossierResponseSchema,
  type CaseDossierResponse,
} from "@naro/domain";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ApiClient } from "../api";

export const CASE_DOSSIER_STALE_TIME_MS = 30_000;

export function caseDossierQueryKey(caseId: string) {
  return ["cases", caseId, "dossier"] as const;
}

export async function fetchCaseDossier(
  apiClient: ApiClient,
  caseId: string,
): Promise<CaseDossierResponse> {
  return apiClient(`/cases/${caseId}/dossier`, {
    parse: (value) => CaseDossierResponseSchema.parse(value),
  });
}

export function useCaseDossier(
  caseId: string,
  options: {
    apiClient: ApiClient;
    enabled?: boolean;
  },
) {
  const enabled = Boolean(caseId) && (options.enabled ?? true);

  return useQuery({
    queryKey: caseDossierQueryKey(caseId),
    enabled,
    staleTime: CASE_DOSSIER_STALE_TIME_MS,
    queryFn: () => fetchCaseDossier(options.apiClient, caseId),
  });
}

export function invalidateCaseDossier(
  queryClient: QueryClient,
  caseId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: caseDossierQueryKey(caseId),
  });
}
