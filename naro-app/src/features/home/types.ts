import { z } from "zod";

import type { TechnicianMatch } from "@/features/ustalar/types";

export const HomeDecisionStateSchema = z.enum([
  "offers_ready",
  "service_in_progress",
  "maintenance_due",
  "quiet",
]);

const ActivityItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  meta: z.string(),
  tone: z.enum(["accent", "info", "success", "warning", "critical"]),
});

const HomeDecisionSchema = z.object({
  state: HomeDecisionStateSchema,
  eyebrow: z.string(),
  title: z.string(),
  description: z.string(),
  statusLabel: z.string(),
  statusTone: z.enum([
    "accent",
    "neutral",
    "success",
    "warning",
    "critical",
    "info",
  ]),
  cardRoute: z.string(),
  primaryActionLabel: z.string().optional(),
  primaryActionRoute: z.string().optional(),
  secondaryActionLabel: z.string().optional(),
  secondaryActionRoute: z.string().optional(),
  metrics: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      hint: z.string().optional(),
    }),
  ),
  badges: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      tone: z.enum([
        "accent",
        "neutral",
        "success",
        "warning",
        "critical",
        "info",
      ]),
    }),
  ),
});

const CampaignOfferSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  priceLabel: z.string(),
  route: z.string(),
  categoryLabel: z.string().optional(),
  deadlineLabel: z.string().optional(),
  fineprint: z.string().optional(),
});

const NearbyServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  distanceLabel: z.string(),
  ratingLabel: z.string(),
  badges: z.array(z.string()),
  route: z.string(),
});

const ActiveProcessSchema = z.object({
  id: z.string(),
  servisAd: z.string(),
  title: z.string(),
  status: z.string(),
  nextStepLabel: z.string(),
  note: z.string(),
  progressValue: z.number(),
  cardRoute: z.string(),
  primaryActionLabel: z.string().optional(),
  primaryActionRoute: z.string().optional(),
});

const TaskQueueItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  route: z.string(),
  tone: z.enum([
    "accent",
    "neutral",
    "success",
    "warning",
    "critical",
    "info",
  ]),
});

export const HomeSummarySchema = z.object({
  decision: HomeDecisionSchema,
  activeProcess: ActiveProcessSchema.nullable(),
  taskQueue: z.array(TaskQueueItemSchema),
  recentActivity: z.array(ActivityItemSchema),
  suggestions: z.array(z.custom<TechnicianMatch>()),
  campaigns: z.array(CampaignOfferSchema),
  nearbyServices: z.array(NearbyServiceSchema),
});

export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type HomeDecisionState = z.infer<typeof HomeDecisionStateSchema>;
export type HomeDecision = z.infer<typeof HomeDecisionSchema>;
export type CampaignOffer = z.infer<typeof CampaignOfferSchema>;
export type NearbyService = z.infer<typeof NearbyServiceSchema>;
export type ActiveProcess = z.infer<typeof ActiveProcessSchema>;
export type TaskQueueItem = z.infer<typeof TaskQueueItemSchema>;
export type HomeSummary = z.infer<typeof HomeSummarySchema>;
