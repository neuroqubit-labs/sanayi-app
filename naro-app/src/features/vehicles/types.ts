import { z } from "zod";

import {
  VehicleKindSchema,
  VehicleTransmissionSchema,
  VehicleFuelTypeSchema,
} from "./schema";

export const VehicleMemoryEventKindSchema = z.enum([
  "maintenance",
  "repair",
  "damage",
  "warranty",
  "document",
]);
export type VehicleMemoryEventKind = z.infer<
  typeof VehicleMemoryEventKindSchema
>;

export const VehicleMemoryEventSchema = z.object({
  id: z.string(),
  kind: VehicleMemoryEventKindSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  dateLabel: z.string(),
  badgeLabel: z.string().optional(),
});
export type VehicleMemoryEvent = z.infer<typeof VehicleMemoryEventSchema>;

export const VehicleWarrantySchema = z.object({
  id: z.string(),
  title: z.string(),
  untilLabel: z.string(),
});
export type VehicleWarranty = z.infer<typeof VehicleWarrantySchema>;

export const VehicleMaintenanceReminderSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  dueLabel: z.string(),
  tone: z
    .enum(["warning", "accent", "critical", "success", "info"])
    .default("warning"),
});
export type VehicleMaintenanceReminder = z.infer<
  typeof VehicleMaintenanceReminderSchema
>;

export const VehicleSchema = z.object({
  id: z.string(),
  plate: z.string(),
  photoUri: z.string().optional(),
  tabThumbnailUri: z.string().optional(),
  vehicleKind: VehicleKindSchema.optional(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  color: z.string().optional(),
  fuel: VehicleFuelTypeSchema.optional(),
  transmission: VehicleTransmissionSchema.optional(),
  chassisNo: z.string().optional(),
  engineNo: z.string().optional(),
  mileageKm: z.number().int(),
  note: z.string().optional(),
  healthLabel: z.string().optional(),
  isActive: z.boolean().default(false),
  lastServiceLabel: z.string().optional(),
  nextServiceLabel: z.string().optional(),
  regularShop: z.string().optional(),
  insuranceExpiryLabel: z.string().optional(),
  chronicNotes: z.array(z.string()).default([]),
  history: z.array(VehicleMemoryEventSchema).default([]),
  warranties: z.array(VehicleWarrantySchema).default([]),
  maintenanceReminders: z.array(VehicleMaintenanceReminderSchema).default([]),
  historyAccessGranted: z.boolean().default(false),
});

export type Vehicle = z.infer<typeof VehicleSchema>;

export type VehicleDraft = {
  plate: string;
  photoUri?: string;
  photoAssetId?: string;
  vehicleKind?: z.infer<typeof VehicleKindSchema>;
  make: string;
  model: string;
  year?: number;
  color?: string;
  fuel?: z.infer<typeof VehicleFuelTypeSchema>;
  transmission?: z.infer<typeof VehicleTransmissionSchema>;
  chassisNo?: string;
  engineNo?: string;
  mileageKm?: number;
  note?: string;
  historyAccessGranted?: boolean;
};
