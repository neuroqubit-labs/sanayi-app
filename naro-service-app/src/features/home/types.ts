import { z } from "zod";

export const BusinessSummarySchema = z.object({
  businessName: z.string(),
  tagline: z.string().optional(),
  availability: z.boolean(),
  stats: z.object({
    activeJobs: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
    weeklyJobs: z.number().int().nonnegative(),
    dailyEarningsLabel: z.string(),
  }),
});
export type BusinessSummary = z.infer<typeof BusinessSummarySchema>;
