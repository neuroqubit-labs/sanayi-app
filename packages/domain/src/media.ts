import { z } from "zod";

export const MediaPurposeSchema = z.enum([
  "case_attachment",
  "technician_certificate",
  "technician_gallery",
  "technician_promo",
  "user_avatar",
]);
export type MediaPurpose = z.infer<typeof MediaPurposeSchema>;

export const MediaVisibilitySchema = z.enum(["public", "private"]);
export type MediaVisibility = z.infer<typeof MediaVisibilitySchema>;

export const MediaStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "deleted",
]);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

export const MediaAssetSchema = z.object({
  id: z.string(),
  purpose: MediaPurposeSchema,
  visibility: MediaVisibilitySchema,
  status: MediaStatusSchema,
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  checksum_sha256: z.string().nullable().default(null),
  preview_url: z.string().nullable().default(null),
  download_url: z.string().nullable().default(null),
  created_at: z.string(),
  uploaded_at: z.string().nullable().default(null),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
