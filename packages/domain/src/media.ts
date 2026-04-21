import { z } from "zod";

// ───────── Purpose master list (brief §2) ─────────

export const MediaPurposeSchema = z.enum([
  "user_avatar",
  "vehicle_license_photo",
  "vehicle_photo",
  "case_damage_photo",
  "case_evidence_photo",
  "case_evidence_video",
  "case_evidence_audio",
  "accident_proof",
  "insurance_doc",
  "technician_avatar",
  "technician_gallery_photo",
  "technician_gallery_video",
  "technician_promo_video",
  "technician_cert",
  "tow_arrival_photo",
  "tow_loading_photo",
  "tow_delivery_photo",
  "campaign_asset",
]);
export type MediaPurpose = z.infer<typeof MediaPurposeSchema>;

// ───────── Owner kind — hangi entity'e bağlı ─────────

export const MediaOwnerKindSchema = z.enum([
  "user",
  "vehicle",
  "service_case",
  "insurance_claim",
  "technician_profile",
  "technician_certificate",
  "campaign",
]);
export type MediaOwnerKind = z.infer<typeof MediaOwnerKindSchema>;

// ───────── Visibility + status ─────────

export const MediaVisibilitySchema = z.enum(["public", "private"]);
export type MediaVisibility = z.infer<typeof MediaVisibilitySchema>;

export const MediaStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "quarantined",
  "deleted",
]);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

// ───────── Dimensions + duration ─────────

export const MediaDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type MediaDimensions = z.infer<typeof MediaDimensionsSchema>;

// ───────── MediaAsset ─────────

export const MediaAssetSchema = z.object({
  id: z.string(),
  purpose: MediaPurposeSchema,
  owner_kind: MediaOwnerKindSchema,
  owner_id: z.string(),
  visibility: MediaVisibilitySchema,
  status: MediaStatusSchema,
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  checksum_sha256: z.string().nullable().default(null),
  dimensions: MediaDimensionsSchema.nullable().default(null),
  duration_sec: z.number().int().nonnegative().nullable().default(null),
  preview_url: z.string().nullable().default(null),
  download_url: z.string().nullable().default(null),
  created_at: z.string(),
  uploaded_at: z.string().nullable().default(null),
  exif_stripped_at: z.string().nullable().default(null),
  antivirus_scanned_at: z.string().nullable().default(null),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

// ───────── Policy — purpose bazlı tek kaynak (brief §2 matrisi) ─────────

export type MediaPurposePolicy = {
  owner_kind: MediaOwnerKind;
  visibility: MediaVisibility;
  /** Byte cinsinden upload üst limit */
  max_bytes: number;
  /** Fotoğraf/görsel için kenar uzunluğu üst limit (pixel). Video/PDF/audio için null. */
  max_dimension_px: number | null;
  /** Video/audio süre üst limit (saniye). Photo/PDF için null. */
  max_duration_sec: number | null;
  /** İzinli MIME prefix listesi (ör. "image/", "video/"). */
  mime_whitelist: string[];
  /** Antivirus worker'ı tetiklensin mi? */
  antivirus_required: boolean;
};

const MB = 1024 * 1024;

export const MEDIA_POLICY: Record<MediaPurpose, MediaPurposePolicy> = {
  user_avatar: {
    owner_kind: "user",
    visibility: "public",
    max_bytes: 5 * MB,
    max_dimension_px: 1024,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  vehicle_license_photo: {
    owner_kind: "vehicle",
    visibility: "private",
    max_bytes: 10 * MB,
    max_dimension_px: 2048,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    antivirus_required: true,
  },
  vehicle_photo: {
    owner_kind: "vehicle",
    visibility: "private",
    max_bytes: 10 * MB,
    max_dimension_px: 2048,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  case_damage_photo: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 15 * MB,
    max_dimension_px: 4096,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    antivirus_required: false,
  },
  case_evidence_photo: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 15 * MB,
    max_dimension_px: 4096,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    antivirus_required: false,
  },
  case_evidence_video: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 200 * MB,
    max_dimension_px: 1920,
    max_duration_sec: 120,
    mime_whitelist: ["video/mp4", "video/quicktime"],
    antivirus_required: false,
  },
  case_evidence_audio: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 20 * MB,
    max_dimension_px: null,
    max_duration_sec: 120,
    mime_whitelist: ["audio/mp4", "audio/m4a", "audio/aac", "audio/mpeg"],
    antivirus_required: false,
  },
  accident_proof: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 15 * MB,
    max_dimension_px: 4096,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    antivirus_required: false,
  },
  insurance_doc: {
    owner_kind: "insurance_claim",
    visibility: "private",
    max_bytes: 20 * MB,
    max_dimension_px: 4096,
    max_duration_sec: null,
    mime_whitelist: ["application/pdf", "image/jpeg", "image/png"],
    antivirus_required: true,
  },
  technician_avatar: {
    owner_kind: "technician_profile",
    visibility: "public",
    max_bytes: 5 * MB,
    max_dimension_px: 1024,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  technician_gallery_photo: {
    owner_kind: "technician_profile",
    visibility: "public",
    max_bytes: 10 * MB,
    max_dimension_px: 1920,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  technician_gallery_video: {
    owner_kind: "technician_profile",
    visibility: "public",
    max_bytes: 100 * MB,
    max_dimension_px: 1920,
    max_duration_sec: 60,
    mime_whitelist: ["video/mp4", "video/quicktime"],
    antivirus_required: false,
  },
  technician_promo_video: {
    owner_kind: "technician_profile",
    visibility: "public",
    max_bytes: 150 * MB,
    max_dimension_px: 1920,
    max_duration_sec: 120,
    mime_whitelist: ["video/mp4", "video/quicktime"],
    antivirus_required: false,
  },
  technician_cert: {
    owner_kind: "technician_certificate",
    visibility: "private",
    max_bytes: 20 * MB,
    max_dimension_px: 2048,
    max_duration_sec: null,
    mime_whitelist: ["application/pdf", "image/jpeg", "image/png"],
    antivirus_required: true,
  },
  tow_arrival_photo: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 10 * MB,
    max_dimension_px: 2048,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  tow_loading_photo: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 10 * MB,
    max_dimension_px: 2048,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  tow_delivery_photo: {
    owner_kind: "service_case",
    visibility: "private",
    max_bytes: 10 * MB,
    max_dimension_px: 2048,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
  campaign_asset: {
    owner_kind: "campaign",
    visibility: "public",
    max_bytes: 15 * MB,
    max_dimension_px: 1920,
    max_duration_sec: null,
    mime_whitelist: ["image/jpeg", "image/png", "image/webp"],
    antivirus_required: false,
  },
};

export function getMediaPolicy(purpose: MediaPurpose): MediaPurposePolicy {
  return MEDIA_POLICY[purpose];
}

export function isMimeAllowed(
  policy: MediaPurposePolicy,
  mime: string,
): boolean {
  return policy.mime_whitelist.some((prefix) =>
    prefix.endsWith("/") ? mime.startsWith(prefix) : mime === prefix,
  );
}

// ───────── Upload intent request şekli ─────────

export const MediaUploadIntentRequestSchema = z.object({
  purpose: MediaPurposeSchema,
  owner_kind: MediaOwnerKindSchema,
  owner_id: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  checksum_sha256: z.string().optional(),
  dimensions: MediaDimensionsSchema.optional(),
  duration_sec: z.number().int().nonnegative().optional(),
});
export type MediaUploadIntentRequest = z.infer<
  typeof MediaUploadIntentRequestSchema
>;
