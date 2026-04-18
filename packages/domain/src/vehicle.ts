import { z } from "zod";

export const VehicleSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plate: z.string(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  created_at: z.string().optional(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;
