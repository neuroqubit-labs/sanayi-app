import { z } from "zod";

export const QuickActionItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  route: z.string(),
  tone: z.enum(["accent", "neutral", "success", "warning", "critical", "info"]),
});

export type QuickActionItem = z.infer<typeof QuickActionItemSchema>;
