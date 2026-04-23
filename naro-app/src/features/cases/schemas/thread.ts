import { z } from "zod";

/**
 * Case thread + notes canonical wire schemas — BE parity
 * app/schemas/case_thread.py (İş 3 shipped 2026-04-23).
 *
 * Endpoint haritası (cases.py + case_thread.py):
 * - POST  /cases/{id}/thread/messages   → ThreadMessageResponse
 * - GET   /cases/{id}/thread/messages   → ThreadMessageListResponse (cursor)
 * - POST  /cases/{id}/thread/seen       → 204 no content
 * - PATCH /cases/{id}/notes             → CaseDetailResponse (owner-only)
 *
 * BE canonical adlar: `sender_role` / `content`. Mock FE ServiceCase
 * mesaj shape'i (`author_role` / `body`) bilinçli olarak burada YOK;
 * presenter katmanında projeksiyon yapılır.
 */

export const ThreadSenderRoleSchema = z.enum(["customer", "technician"]);
export type ThreadSenderRole = z.infer<typeof ThreadSenderRoleSchema>;

export const ThreadMessageResponseSchema = z.object({
  id: z.string().uuid(),
  sender_role: ThreadSenderRoleSchema,
  content: z.string(),
  created_at: z.string(),
});
export type ThreadMessageResponse = z.infer<typeof ThreadMessageResponseSchema>;

export const ThreadMessageCreatePayloadSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type ThreadMessageCreatePayload = z.infer<
  typeof ThreadMessageCreatePayloadSchema
>;

/**
 * Cursor paginated response — `next_cursor=null` → son sayfa.
 * FE TanStack `useInfiniteQuery` ile tüketilir; `getNextPageParam`
 * doğrudan `next_cursor` ya da `undefined` döner.
 */
export const ThreadMessageListResponseSchema = z.object({
  items: z.array(ThreadMessageResponseSchema),
  next_cursor: z.string().nullable().optional(),
});
export type ThreadMessageListResponse = z.infer<
  typeof ThreadMessageListResponseSchema
>;

export const CaseNotesPayloadSchema = z.object({
  content: z.string().max(2000).nullable(),
});
export type CaseNotesPayload = z.infer<typeof CaseNotesPayloadSchema>;

/**
 * BE HTTPException detail tipleri — anti-disintermediation + closed
 * case. FE UX:
 * - 422 disintermediation_phone_number / disintermediation_email
 *   → toast `message` alanıyla; input temizlenmez (kullanıcı düzeltir)
 * - 403 case_closed → input disabled + banner "Bu vaka kapandı"
 */
export const ThreadSendErrorTypeSchema = z.enum([
  "disintermediation_phone_number",
  "disintermediation_email",
  "case_closed",
]);
export type ThreadSendErrorType = z.infer<typeof ThreadSendErrorTypeSchema>;

export const ThreadSendErrorDetailSchema = z.object({
  type: ThreadSendErrorTypeSchema,
  message: z.string(),
});
export type ThreadSendErrorDetail = z.infer<
  typeof ThreadSendErrorDetailSchema
>;
