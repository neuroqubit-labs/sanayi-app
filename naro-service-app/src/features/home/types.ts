import { z } from "zod";

export const BusinessSummarySchema = z.object({
  businessName: z.string(),
  availability: z.boolean(),
  stats: z.object({
    activeJobs: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
    weeklyJobs: z.number().int().nonnegative(),
  }),
});
export type BusinessSummary = z.infer<typeof BusinessSummarySchema>;
