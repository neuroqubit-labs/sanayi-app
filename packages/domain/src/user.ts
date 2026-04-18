import { z } from "zod";

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
