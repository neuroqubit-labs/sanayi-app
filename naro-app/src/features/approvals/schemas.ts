/**
 * Approval schemas — canonical source: `@naro/domain/approval`.
 *
 * Bu dosya thin re-export katmanı. Feature tarafı tek import path'ten
 * (feature-local) schema tüketmeye devam eder; taşınma sırasında
 * call-site kırılmasın diye bu wrapper korunur.
 *
 * Domain'deki approval modülü BE Pydantic (`app/api/v1/routes/approvals.py`)
 * ile 1:1 eşleşir — kind/status enum'ları, request/decide payload'ları,
 * response shape'i orada tanımlı.
 */

export {
  CaseApprovalKindSchema,
  CaseApprovalStatusSchema,
  ApprovalPaymentMethodSchema,
  ApprovalPaymentStateSchema,
  ApprovalLineItemSchema,
  ApprovalResponseSchema,
  ApprovalRequestPayloadSchema,
  ApprovalDecidePayloadSchema,
} from "@naro/domain";
export type {
  CaseApprovalKind,
  CaseApprovalStatus,
  ApprovalPaymentMethod,
  ApprovalPaymentState,
  ApprovalLineItem,
  ApprovalResponse,
  ApprovalRequestPayload,
  ApprovalDecidePayload,
} from "@naro/domain";
