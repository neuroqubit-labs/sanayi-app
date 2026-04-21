import { z } from "zod";

const MatchBadgeSchema = z.object({
  id: z.string(),
  label: z.string(),
  tone: z.enum(["accent", "neutral", "success", "warning", "critical", "info"]),
});

const TechnicianCampaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  priceLabel: z.string(),
});

const TechnicianReviewSchema = z.object({
  id: z.string(),
  author: z.string(),
  body: z.string(),
  rating: z.number().min(1).max(5).optional(),
  createdAt: z.string().optional(),
  serviceLabel: z.string().optional(),
});
export type TechnicianReview = z.infer<typeof TechnicianReviewSchema>;

const ServiceDetailSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const UstalarCategorySchema = z.enum([
  "usta",
  "servis",
  "lastik",
  "sanayi",
  "hasar",
]);
export type UstalarCategory = z.infer<typeof UstalarCategorySchema>;

export const TechnicianAvailabilitySchema = z.enum([
  "available",
  "busy",
  "offline",
]);
export type TechnicianAvailability = z.infer<typeof TechnicianAvailabilitySchema>;

export const TechnicianMatchSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  reason: z.string(),
  summary: z.string(),
  rating: z.number(),
  reviewCount: z.number().int(),
  distanceKm: z.number(),
  responseMinutes: z.number().int(),
  priceLabel: z.string(),
  availabilityLabel: z.string(),
  availability: TechnicianAvailabilitySchema.default("available"),
  badges: z.array(MatchBadgeSchema),
  specialties: z.array(z.string()),
  categories: z.array(UstalarCategorySchema).default([]),
});

export const TechnicianProfileSchema = TechnicianMatchSchema.extend({
  biography: z.string(),
  serviceMode: z.string(),
  estimatedDuration: z.string(),
  guarantee: z.string(),
  pickup: z.string(),
  expertise: z.array(z.string()),
  campaigns: z.array(TechnicianCampaignSchema),
  serviceDetails: z.array(ServiceDetailSchema),
  reviews: z.array(TechnicianReviewSchema),
  workingHours: z.string().optional(),
  areaLabel: z.string().optional(),
  completedJobs: z.number().int().optional(),
  verifiedSinceLabel: z.string().optional(),
});

export type TechnicianMatch = z.infer<typeof TechnicianMatchSchema>;
export type TechnicianProfile = z.infer<typeof TechnicianProfileSchema>;
