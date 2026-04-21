import { z } from "zod";

export const RecordItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  dateLabel: z.string(),
  route: z.string(),
  amountLabel: z.string().optional(),
  statusLabel: z.string(),
  statusTone: z.enum([
    "accent",
    "neutral",
    "success",
    "warning",
    "critical",
    "info",
  ]),
  progressValue: z.number().optional(),
  progressLabel: z.string().optional(),
  kind: z.enum(["maintenance", "breakdown", "accident", "towing"]),
  stateCategory: z.enum(["active", "completed"]),
});

export const RecordsFeedSchema = z.object({
  activeRecords: z.array(RecordItemSchema),
  items: z.array(RecordItemSchema),
});

export type RecordItem = z.infer<typeof RecordItemSchema>;
export type RecordsFeed = z.infer<typeof RecordsFeedSchema>;
