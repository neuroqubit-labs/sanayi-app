import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/runtime";

import {
  TechnicianPayoutItemSchema,
  type TechnicianPayoutItem,
} from "./schemas";

export function useMyPayoutsQuery() {
  return useQuery<TechnicianPayoutItem[]>({
    queryKey: ["billing", "my-payouts"],
    queryFn: async () => {
      const raw = await apiClient("/technicians/me/payouts");
      return TechnicianPayoutItemSchema.array().parse(raw);
    },
    staleTime: 60 * 1000,
  });
}
