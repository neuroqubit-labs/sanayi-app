/**
 * Approval schemas — canonical source: `@naro/domain/approval`.
 *
 * Teknisyen uygulaması approval create (POST /cases/{id}/approvals) için
 * `ApprovalRequestPayloadSchema` kullanır. Customer-side `ApprovalDecidePayload`
 * burada şimdilik tüketilmiyor olsa da drift önlemek için export ediyoruz —
 * gelecek turda teknisyen "müşteri kararını göster" UI'sı gelirse sıfır ek iş.
 */

export {
  CaseApprovalKindSchema,
  CaseApprovalStatusSchema,
  ApprovalLineItemSchema,
  ApprovalResponseSchema,
  ApprovalRequestPayloadSchema,
  ApprovalDecidePayloadSchema,
} from "@naro/domain";
export type {
  CaseApprovalKind,
  CaseApprovalStatus,
  ApprovalLineItem,
  ApprovalResponse,
  ApprovalRequestPayload,
  ApprovalDecidePayload,
} from "@naro/domain";
