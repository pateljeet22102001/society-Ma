import { z } from "zod";

export const incomeSchema = z.object({
  transaction_date: z.string().min(1, "Date is required"),
  category_id: z.string().uuid("Select a category"),
  flat_id: z.string().uuid().optional().or(z.literal("")),
  person_name: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  payment_mode: z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]),
  reference_number: z.string().optional(),
  description: z.string().optional(),
  receipt_number: z.string().optional(),
});

export const expenseSchema = z.object({
  transaction_date: z.string().min(1, "Date is required"),
  category_id: z.string().uuid("Select a category"),
  vendor_name: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  payment_mode: z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]),
  reference_number: z.string().optional(),
  description: z.string().optional(),
  bill_number: z.string().optional(),
  notes: z.string().optional(),
});

export const generateMaintenanceSchema = z.object({
  bill_month: z.coerce.number().int().min(1).max(12),
  bill_year: z.coerce.number().int().min(2000),
  amount: z.coerce.number().min(0),
  late_fee: z.coerce.number().min(0),
});

export const maintenancePaymentSchema = z.object({
  bill_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_mode: z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

export type IncomeInput = z.infer<typeof incomeSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type GenerateMaintenanceInput = z.infer<typeof generateMaintenanceSchema>;
export type MaintenancePaymentInput = z.infer<typeof maintenancePaymentSchema>;
