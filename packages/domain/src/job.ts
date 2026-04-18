import { z } from "zod";

export const JobKindSchema = z.enum(["accident", "towing"]);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobStatusSchema = z.enum([
  "requested",
  "matching",
  "assigned",
  "en_route",
  "on_site",
  "completed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const JobRequestSchema = z.object({
  kind: JobKindSchema,
  pickup_geo: GeoPointSchema,
  vehicle_id: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});
export type JobRequest = z.infer<typeof JobRequestSchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  vehicle_id: z.string().uuid().nullable(),
  kind: JobKindSchema,
  status: JobStatusSchema,
  pickup_geo: GeoPointSchema,
  dropoff_geo: GeoPointSchema.nullable(),
  assigned_technician_id: z.string().uuid().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
  accepted_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export type Job = z.infer<typeof JobSchema>;

export const QuoteSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: z.string().default("TRY"),
  eta_minutes: z.number().int().nonnegative().optional(),
  created_at: z.string(),
});
export type Quote = z.infer<typeof QuoteSchema>;
