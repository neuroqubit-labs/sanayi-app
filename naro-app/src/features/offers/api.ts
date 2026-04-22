import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import { OfferResponseSchema, type OfferResponse } from "./schemas";

/**
 * Offers canonical wrappers — BE shipped 0220362 (2026-04-23).
 * Customer tarafı: list + accept + shortlist + reject. Teknisyen submit
 * service app scope'unda (ayrı wire-up).
 */

export function useCaseOffers(caseId: string) {
  return useQuery<OfferResponse[]>({
    queryKey: ["offers", "case", caseId],
    enabled: caseId.length > 0,
    queryFn: async () => {
      const raw = await apiClient(`/offers/case/${caseId}`);
      return OfferResponseSchema.array().parse(raw);
    },
    staleTime: 15 * 1000,
  });
}

function createMutationFor(
  action: "accept" | "shortlist" | "reject",
) {
  return function useAction(offerId: string, caseId: string) {
    const queryClient = useQueryClient();
    return useMutation<OfferResponse, Error, void>({
      mutationFn: async () => {
        const raw = await apiClient(`/offers/${offerId}/${action}`, {
          method: "POST",
        });
        return OfferResponseSchema.parse(raw);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["offers", "case", caseId],
        });
        queryClient.invalidateQueries({ queryKey: ["cases"] });
      },
    });
  };
}

export const useAcceptOffer = createMutationFor("accept");
export const useShortlistOffer = createMutationFor("shortlist");
export const useRejectOffer = createMutationFor("reject");
