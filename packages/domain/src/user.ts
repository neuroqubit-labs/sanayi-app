import { z } from "zod";

import { MediaAssetSchema } from "./media";

export const UserRoleSchema = z.enum(["customer", "technician", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["pending", "active", "suspended"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  full_name: z.string().nullable(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type User = z.infer<typeof UserSchema>;

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
