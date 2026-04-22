import { z } from "zod";

/**
 * Zod ↔ Pydantic parity — naro-backend/app/schemas/vehicle.py.
 * Mobil-backend wire-up brief §PR-C.
 */

export const VehicleFuelTypeSchema = z.enum([
  "petrol",
  "diesel",
  "lpg",
  "electric",
  "hybrid",
  "other",
]);
export type VehicleFuelType = z.infer<typeof VehicleFuelTypeSchema>;

/**
 * BE canonical — DB CHECK constraint ile enforce edilir (owner/driver/family).
 * Parity audit P0-3 (2026-04-23): FE önceki `partner` + `observer` değerleri
 * kaldırıldı, canonical 3-değere hizalandı.
 */
export const UserVehicleRoleSchema = z.enum(["owner", "driver", "family"]);
export type UserVehicleRole = z.infer<typeof UserVehicleRoleSchema>;

// ─── POST /vehicles body ───────────────────────────────────────────────────

export const VehicleCreatePayloadSchema = z.object({
  plate: z.string().min(1).max(32),
  make: z.string().max(64).nullable().optional(),
  model: z.string().max(128).nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  color: z.string().max(64).nullable().optional(),
  fuel_type: VehicleFuelTypeSchema.nullable().optional(),
  vin: z.string().max(32).nullable().optional(),
  current_km: z.number().int().min(0).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  is_primary: z.boolean().default(true),
  inspection_valid_until: z.string().nullable().optional(),
  inspection_kind: z.string().max(32).nullable().optional(),
  kasko_valid_until: z.string().nullable().optional(),
  kasko_insurer: z.string().max(255).nullable().optional(),
  trafik_valid_until: z.string().nullable().optional(),
  trafik_insurer: z.string().max(255).nullable().optional(),
  exhaust_valid_until: z.string().nullable().optional(),
});
export type VehicleCreatePayload = z.infer<typeof VehicleCreatePayloadSchema>;

// ─── PATCH /vehicles/{id} body ─────────────────────────────────────────────

export const VehicleUpdatePayloadSchema = VehicleCreatePayloadSchema.partial();
export type VehicleUpdatePayload = z.infer<typeof VehicleUpdatePayloadSchema>;

// ─── GET response ──────────────────────────────────────────────────────────

export const VehicleResponseSchema = z.object({
  id: z.string().uuid(),
  plate: z.string(),
  plate_normalized: z.string(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().int().nullable(),
  color: z.string().nullable(),
  fuel_type: VehicleFuelTypeSchema.nullable(),
  vin: z.string().nullable(),
  current_km: z.number().int().nullable(),
  note: z.string().nullable(),
  inspection_valid_until: z.string().nullable(),
  inspection_kind: z.string().nullable(),
  kasko_valid_until: z.string().nullable(),
  kasko_insurer: z.string().nullable(),
  trafik_valid_until: z.string().nullable(),
  trafik_insurer: z.string().nullable(),
  exhaust_valid_until: z.string().nullable(),
  history_consent_granted: z.boolean(),
  history_consent_granted_at: z.string().nullable(),
  history_consent_revoked_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type VehicleResponse = z.infer<typeof VehicleResponseSchema>;

export const VehicleListSchema = z.array(VehicleResponseSchema);

// ─── POST /vehicles/{id}/history_consent ───────────────────────────────────

export const HistoryConsentPayloadSchema = z.object({
  granted: z.boolean(),
});
export type HistoryConsentPayload = z.infer<typeof HistoryConsentPayloadSchema>;

// ─── Dossier ───────────────────────────────────────────────────────────────

export const VehicleDossierSchema = z.object({
  vehicle: VehicleResponseSchema,
  primary_owner_id: z.string().uuid().nullable(),
  additional_user_ids: z.array(z.string().uuid()).default([]),
  previous_case_count: z.number().int().default(0),
  last_case_id: z.string().uuid().nullable(),
  last_case_title: z.string().nullable(),
  last_case_updated_at: z.string().nullable(),
});
export type VehicleDossier = z.infer<typeof VehicleDossierSchema>;
