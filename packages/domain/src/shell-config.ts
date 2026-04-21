import { z } from "zod";

import {
  ProviderTypeSchema,
  TechnicianCertificateKindSchema,
  TechnicianVerifiedLevelSchema,
  UserStatusSchema,
} from "./user";

// ───────── Provider mode ─────────

export const ProviderModeSchema = z.enum(["business", "individual"]);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

// ───────── Home layout variants ─────────

export const HomeLayoutSchema = z.enum([
  "tow_focused",
  "full",
  "business_lite",
  "minimal",
  "damage_shop",
]);
export type HomeLayout = z.infer<typeof HomeLayoutSchema>;

// ───────── Quick action ─────────

export const QuickActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  route: z.string(),
  requires_capability: z.string().nullable().default(null),
});
export type QuickAction = z.infer<typeof QuickActionSchema>;

// ───────── Shell config ─────────

export const ShellConfigSchema = z.object({
  primary_provider_type: ProviderTypeSchema,
  active_provider_type: ProviderTypeSchema,
  provider_mode: ProviderModeSchema,
  secondary_provider_types: z.array(ProviderTypeSchema).default([]),
  verified_level: TechnicianVerifiedLevelSchema,
  admission_status: UserStatusSchema,
  admission_gate_passed: z.boolean().default(false),
  enabled_capabilities: z.array(z.string()).default([]),
  home_layout: HomeLayoutSchema,
  tab_set: z.array(z.string()),
  quick_action_set: z.array(QuickActionSchema).default([]),
  required_onboarding_steps: z.array(z.string()).default([]),
  required_cert_kinds: z.array(TechnicianCertificateKindSchema).default([]),
  role_config_version: z.number().int(),
});
export type ShellConfig = z.infer<typeof ShellConfigSchema>;

// ───────── V1 tab slot constants ─────────

export const V1_FIXED_TAB_SET = ["home", "havuz", "kayitlar", "profil"] as const;
export type V1FixedTabId = (typeof V1_FIXED_TAB_SET)[number];
