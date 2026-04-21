import { z } from "zod";

export const NotificationKindSchema = z.enum([
  "offer",
  "case_status",
  "case_message",
  "case_document",
  "maintenance_reminder",
  "invoice",
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
