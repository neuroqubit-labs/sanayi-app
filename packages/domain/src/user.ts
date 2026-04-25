import { z } from "zod";

import { MediaAssetSchema } from "./media";

export const UserRoleSchema = z.enum(["customer", "technician", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["pending", "active", "suspended"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserApprovalStatusSchema = z.enum([
  "pending",
  "active",
  "suspended",
  "rejected",
]);
export type UserApprovalStatus = z.infer<typeof UserApprovalStatusSchema>;

/**
 * Authenticated user's own profile — GET /users/me response.
 * Backend `app/schemas/user.py::UserResponse` ile 1:1 eşleşir.
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  full_name: z.string().nullable(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  approval_status: UserApprovalStatusSchema.nullable().default(null),
  locale: z.string().default("tr-TR"),
  avatar_asset_id: z.string().uuid().nullable().default(null),
  kvkk_consented_at: z.string().nullable().default(null),
  last_login_at: z.string().nullable().default(null),
  created_at: z.string(),
});
export type User = z.infer<typeof UserSchema>;

/**
 * PATCH /users/me body — partial update.
 * Phone değişikliği bu endpoint'te yapılmaz (OTP-reverify ayrı akış).
 * `avatar_asset_id: null` gönderilirse mevcut avatar temizlenir.
 * `kvkk_consented_at` profile-setup submit anında ISO timestamp ile
 * yazılır (industry-standard pasif kabul).
 */
export const UserUpdatePayloadSchema = z.object({
  full_name: z.string().trim().min(2).max(255).optional(),
  email: z.string().email().optional(),
  locale: z.string().min(2).max(10).optional(),
  avatar_asset_id: z.string().uuid().nullable().optional(),
  kvkk_consented_at: z.string().datetime().optional(),
});
export type UserUpdatePayload = z.infer<typeof UserUpdatePayloadSchema>;

export const TechnicianCapabilitySchema = z.object({
  insurance_case_handler: z.boolean().default(false),
  on_site_repair: z.boolean().default(false),
  valet_service: z.boolean().default(false),
  towing_coordination: z.boolean().default(false),
});
export type TechnicianCapability = z.infer<typeof TechnicianCapabilitySchema>;

export const TechnicianVerifiedLevelSchema = z.enum([
  "basic",
  "verified",
  "premium",
]);
export type TechnicianVerifiedLevel = z.infer<
  typeof TechnicianVerifiedLevelSchema
>;

export const ProviderTypeSchema = z.enum([
  "usta",
  "cekici",
  "oto_aksesuar",
  "kaporta_boya",
  "lastik",
  "oto_elektrik",
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const TechnicianCertificateKindSchema = z.enum([
  "identity",
  "tax_registration",
  "trade_registry",
  "insurance",
  "technical",
  "vehicle_license",
  "tow_operator",
]);
export type TechnicianCertificateKind = z.infer<
  typeof TechnicianCertificateKindSchema
>;

export const TechnicianCertificateStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
]);
export type TechnicianCertificateStatus = z.infer<
  typeof TechnicianCertificateStatusSchema
>;

export const TechnicianCertificateSchema = z.object({
  id: z.string(),
  technician_id: z.string(),
  kind: TechnicianCertificateKindSchema,
  title: z.string(),
  file_url: z.string(),
  mime_type: z.string().optional(),
  asset: MediaAssetSchema.nullable().default(null),
  uploaded_at: z.string(),
  verified_at: z.string().nullable().default(null),
  expires_at: z.string().nullable().default(null),
  status: TechnicianCertificateStatusSchema.default("pending"),
  reviewer_note: z.string().nullable().default(null),
});
export type TechnicianCertificate = z.infer<typeof TechnicianCertificateSchema>;
