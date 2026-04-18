import { z } from "zod";

export const VehicleSchema = z.object({
  id: z.string(),
  plate: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  color: z.string().optional(),
  isActive: z.boolean().default(false),
});
export type Vehicle = z.infer<typeof VehicleSchema>;
