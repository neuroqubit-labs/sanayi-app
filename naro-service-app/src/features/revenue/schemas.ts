import { z } from "zod";

/**
 * Zod ↔ Pydantic parity — naro-backend/app/api/v1/routes/billing.py
 * (list_my_payouts endpoint response).
 */

export const TechnicianPayoutItemSchema = z.object({
  settlement_id: z.string().uuid(),
  case_id: z.string().uuid(),
  net_to_technician_amount: z.number(),
  platform_currency: z.string().default("TRY"),
  captured_at: z.string(),
  payout_scheduled_at: z.string().nullable(),
  payout_completed_at: z.string().nullable(),
  payout_reference: z.string().nullable(),
});
export type TechnicianPayoutItem = z.infer<typeof TechnicianPayoutItemSchema>;
