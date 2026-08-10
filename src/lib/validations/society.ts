import { z } from "zod";

export const wingSchema = z.object({
  name: z
    .string()
    .min(1, "Wing name is required")
    .max(20, "Wing name is too long")
    .regex(/^[A-Za-z0-9]+$/, "Use letters/numbers only"),
  total_flats: z.coerce.number().int().min(1, "At least 1 flat").max(500, "Max 500 flats"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

export const flatSchema = z.object({
  wing_id: z.string().uuid("Select a wing"),
  flat_number: z.string().min(1, "Flat number is required"),
  owner_name: z.string().optional(),
  resident_name: z.string().optional(),
  mobile_number: z
    .string()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s]{7,15}$/.test(v), "Enter a valid mobile number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  occupancy_type: z.enum(["owner", "tenant", "vacant"]),
  members_count: z.coerce.number().int().min(0),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});

export const societySettingsSchema = z.object({
  name: z.string().min(1, "Society name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  registration_number: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  ifsc: z.string().optional(),
  upi_id: z.string().optional(),
  logo_url: z.string().optional(),
});

export const maintenanceSettingsSchema = z.object({
  default_amount: z.coerce.number().min(0, "Amount cannot be negative"),
  due_day: z.coerce.number().int().min(1).max(28),
  late_fee: z.coerce.number().min(0, "Late fee cannot be negative"),
});

export type WingInput = z.infer<typeof wingSchema>;
export type FlatInput = z.infer<typeof flatSchema>;
export type SocietySettingsInput = z.infer<typeof societySettingsSchema>;
export type MaintenanceSettingsInput = z.infer<typeof maintenanceSettingsSchema>;
