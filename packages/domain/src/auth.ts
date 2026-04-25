import { z } from "zod";

import {
  UserApprovalStatusSchema,
  UserRoleSchema,
} from "./user";

export const OtpChannelSchema = z.enum(["sms", "email"]);
export type OtpChannel = z.infer<typeof OtpChannelSchema>;

const OtpTargetRoleSchema = z.enum(["customer", "technician"]);
export type OtpTargetRole = z.infer<typeof OtpTargetRoleSchema>;

export const OtpRequestSchema = z
  .object({
    channel: OtpChannelSchema,
    phone: z.string().optional(),
    email: z.string().email().optional(),
    role: OtpTargetRoleSchema.default("customer"),
  })
  .refine((v) => Boolean(v.phone) !== Boolean(v.email), {
    message: "phone veya email'den tam biri gerekir",
  });
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpRequestResponseSchema = z.object({
  delivery_id: z.string(),
  expires_in_seconds: z.number().int().positive(),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>;

export const OtpVerifySchema = z.object({
  delivery_id: z.string(),
  code: z.string().min(4).max(8),
});
export type OtpVerify = z.infer<typeof OtpVerifySchema>;

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal("bearer"),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

/**
 * /auth/otp/verify response (BE OtpVerifyResponse parity).
 * Mobile routing matrisi tek round-trip ile karar versin diye user/profile
 * durumu zenginleştirilmiş — ayrı /shell-config çağrısına gerek yok.
 */
export const OtpVerifyResponseSchema = TokenPairSchema.extend({
  user_id: z.string().uuid(),
  role: UserRoleSchema,
  approval_status: UserApprovalStatusSchema.nullable().default(null),
  is_new_user: z.boolean().default(false),
  profile_completed: z.boolean().default(true),
});
export type OtpVerifyResponse = z.infer<typeof OtpVerifyResponseSchema>;

export const RefreshRequestSchema = z.object({
  refresh_token: z.string(),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
