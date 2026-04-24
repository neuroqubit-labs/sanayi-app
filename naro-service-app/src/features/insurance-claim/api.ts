import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/runtime";

const InsuranceClaimSubmitPayloadSchema = z.object({
  case_id: z.string().uuid(),
  policy_number: z.string().min(1),
  insurer: z.string().min(1),
  coverage_kind: z.enum(["kasko", "trafik"]),
  estimate_amount: z.string().nullable().optional(),
  policy_holder_name: z.string().nullable().optional(),
  policy_holder_phone: z.string().nullable().optional(),
  currency: z.string().default("TRY"),
  notes: z.string().nullable().optional(),
  insurer_claim_reference: z.string().nullable().optional(),
});

export type InsuranceClaimSubmitPayload = z.infer<
  typeof InsuranceClaimSubmitPayloadSchema
>;

const InsuranceClaimResponseSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  policy_number: z.string(),
  insurer: z.string(),
  coverage_kind: z.enum(["kasko", "trafik"]),
  status: z.enum(["submitted", "accepted", "paid", "rejected"]),
});

export type InsuranceClaimResponse = z.infer<
  typeof InsuranceClaimResponseSchema
>;

export function useSubmitTechnicianInsuranceClaim() {
  const queryClient = useQueryClient();
  return useMutation<InsuranceClaimResponse, Error, InsuranceClaimSubmitPayload>({
    mutationFn: async (payload) => {
      const body = InsuranceClaimSubmitPayloadSchema.parse(payload);
      const raw = await apiClient("/technicians/me/insurance-claims", {
        method: "POST",
        body: JSON.parse(JSON.stringify(body)),
      });
      return InsuranceClaimResponseSchema.parse(raw);
    },
    onSuccess: (_claim, payload) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", "live"] });
      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({
        queryKey: ["jobs", "live", "detail", payload.case_id],
      });
    },
  });
}
