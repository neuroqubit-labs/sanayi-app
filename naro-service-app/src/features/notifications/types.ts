import { z } from "zod";

export const NotificationKindSchema = z.enum([
  "pool_new_case",
  "appointment_incoming",
  "appointment_cancelled",
  "offer_accepted",
  "offer_rejected",
  "parts_approval_response",
  "invoice_response",
  "case_message",
  "invoice_paid",
  "insurance_update",
  "campaign_stats",
  "system",
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string(),
  timeAgo: z.string(),
  createdAt: z.string(),
  unread: z.boolean(),
  route: z.string().optional(),
});
export type NotificationItem = z.infer<typeof NotificationSchema>;
