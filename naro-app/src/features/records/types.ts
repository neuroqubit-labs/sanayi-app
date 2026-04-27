import { z } from "zod";

export const RecordBadgeToneSchema = z.enum([
  "accent",
  "neutral",
  "success",
  "warning",
  "critical",
  "info",
]);

export const RecordItemSchema = z.object({
  id: z.string(),
  vehicleId: z.string().uuid(),
  title: z.string(),
  subtitle: z.string(),
  dateLabel: z.string(),
  createdLabel: z.string(),
  updatedLabel: z.string(),
  route: z.string(),
  amountLabel: z.string().optional(),
  statusLabel: z.string(),
  statusTone: RecordBadgeToneSchema,
  progressValue: z.number().optional(),
  progressLabel: z.string().optional(),
  kind: z.enum(["maintenance", "breakdown", "accident", "towing"]),
  kindLabel: z.string(),
  vehicleLabel: z.string().optional(),
  locationLabel: z.string().optional(),
  offerCount: z.number().int().nonnegative().default(0),
  hasOffers: z.boolean().default(false),
  nextStepLabel: z.string(),
  urgencyLabel: z.string().optional(),
  urgencyTone: RecordBadgeToneSchema.optional(),
  primaryActionLabel: z.string().optional(),
  primaryActionRoute: z.string().optional(),
  stateCategory: z.enum(["active", "completed"]),
});

export const RecordsFeedSchema = z.object({
  activeRecords: z.array(RecordItemSchema),
  items: z.array(RecordItemSchema),
});

export type RecordItem = z.infer<typeof RecordItemSchema>;
export type RecordBadgeTone = z.infer<typeof RecordBadgeToneSchema>;
export type RecordsFeed = z.infer<typeof RecordsFeedSchema>;
