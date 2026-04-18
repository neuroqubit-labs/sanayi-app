import { z } from "zod";

export const HomeSummarySchema = z.object({
  activeProcess: z
    .object({
      title: z.string(),
      status: z.string(),
      servisAd: z.string(),
    })
    .nullable(),
  recentActivity: z.array(z.unknown()).default([]),
  suggestions: z.array(z.unknown()).default([]),
  campaigns: z.array(z.unknown()).default([]),
});
export type HomeSummary = z.infer<typeof HomeSummarySchema>;
