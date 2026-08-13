import { z } from "zod";

const paymentMode = z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]);

export const eventSchema = z.object({
  name: z.string().trim().min(2, "Event name is required"),
  event_year: z.coerce.number().int().min(2000),
  start_date: z.string().optional(), end_date: z.string().optional(),
  contribution_amount: z.coerce.number().min(0), due_date: z.string().optional(),
  description: z.string().optional(),
});
export const eventPaymentSchema = z.object({
  contribution_id: z.string().uuid(), amount: z.coerce.number().positive(),
  payment_date: z.string().min(1), payment_mode: paymentMode, reference_number: z.string().optional(),
});
export const eventAavakSchema = z.object({
  event_id: z.string().uuid(), contribution_type: z.enum(["money", "item"]),
  category: z.string().trim().min(1), donor_name: z.string().optional(), mobile_number: z.string().optional(),
  amount: z.coerce.number().min(0).optional(), payment_mode: paymentMode.optional(),
  item_name: z.string().optional(), quantity: z.coerce.number().min(0).optional(),
  unit: z.string().optional(), unit_price: z.coerce.number().min(0).optional(),
  contribution_date: z.string().min(1), reference_number: z.string().optional(), notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.contribution_type === "money" && !data.amount) ctx.addIssue({ code: "custom", path: ["amount"], message: "Amount is required" });
  if (data.contribution_type === "item" && (!data.item_name || !data.quantity)) ctx.addIssue({ code: "custom", path: ["item_name"], message: "Item and quantity are required" });
});
export const eventExpenseSchema = z.object({
  event_id: z.string().uuid(), category: z.string().trim().min(1), vendor_name: z.string().optional(),
  amount: z.coerce.number().positive(), expense_date: z.string().min(1), payment_mode: paymentMode,
  reference_number: z.string().optional(), notes: z.string().optional(),
});

export type EventInput = z.infer<typeof eventSchema>;
export type EventPaymentInput = z.infer<typeof eventPaymentSchema>;
export type EventAavakInput = z.infer<typeof eventAavakSchema>;
export type EventExpenseInput = z.infer<typeof eventExpenseSchema>;
