"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DELETE_FINANCE_ROLES, FINANCE_ROLES, requireSocietyRole } from "@/lib/society";
import {
  generateMaintenanceSchema,
  maintenancePaymentSchema,
} from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils";
import type { MaintenanceStatus } from "@/types/database";
import { financialYearWarning } from "@/lib/financial-year";

export type ActionResult = { success: boolean; message?: string; requiresConfirmation?: boolean };

function resolveStatus(total: number, paid: number, dueDate?: string | null): MaintenanceStatus {
  if (paid <= 0) {
    if (dueDate && new Date(dueDate) < new Date()) return "overdue";
    return "pending";
  }
  if (paid >= total) return "paid";
  return "partially_paid";
}

export async function generateMaintenanceBillsAction(input: unknown): Promise<ActionResult> {
  const parsed = generateMaintenanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { society, user } = await requireSocietyRole(FINANCE_ROLES);

    const { data: settings } = await supabase
      .from("maintenance_settings")
      .select("*")
      .eq("society_id", society.id)
      .maybeSingle();

    const amount = parsed.data.amount;
    const lateFeeDefault = parsed.data.late_fee ?? settings?.late_fee ?? 0;
    const dueDay = settings?.due_day ?? 10;
    const periodMonths = parsed.data.period_months;

    const { data: flats, error: flatsError } = await supabase
      .from("flats")
      .select("id")
      .eq("society_id", society.id)
      .eq("status", "active");

    if (flatsError) throw flatsError;
    if (!flats?.length) {
      return { success: false, message: "No active flats found" };
    }

    const { data: existingBills, error: existingError } = await supabase
      .from("maintenance_bills")
      .select("flat_id,bill_month,bill_year,period_months")
      .eq("society_id", society.id);
    if (existingError) throw existingError;
    const requestedStart = parsed.data.bill_year * 12 + parsed.data.bill_month - 1;
    const requestedEnd = requestedStart + periodMonths - 1;

    const dueDate = new Date(parsed.data.bill_year, parsed.data.bill_month - 1, dueDay)
      .toISOString()
      .slice(0, 10);

    const bills = [];
    let skippedOverlaps = 0;

    for (const flat of flats) {
      const overlaps = (existingBills || []).some((existing) => {
        if (existing.flat_id !== flat.id) return false;
        const existingStart = Number(existing.bill_year) * 12 + Number(existing.bill_month) - 1;
        const existingEnd = existingStart + Number(existing.period_months || 1) - 1;
        return requestedStart <= existingEnd && existingStart <= requestedEnd;
      });
      if (overlaps) {
        skippedOverlaps += 1;
        continue;
      }
      const { data: previous } = await supabase
        .from("maintenance_bills")
        .select("pending_amount")
        .eq("flat_id", flat.id)
        .eq("society_id", society.id)
        .order("bill_year", { ascending: false })
        .order("bill_month", { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousOutstanding = Number(previous?.pending_amount || 0);
      const total = amount + previousOutstanding + Number(lateFeeDefault);

      bills.push({
        society_id: society.id,
        flat_id: flat.id,
        bill_month: parsed.data.bill_month,
        bill_year: parsed.data.bill_year,
        period_months: periodMonths,
        maintenance_amount: amount,
        previous_outstanding: previousOutstanding,
        late_fee: lateFeeDefault,
        total_amount: total,
        paid_amount: 0,
        pending_amount: total,
        due_date: dueDate,
        status: "pending" as const,
        notes: periodMonths > 1 ? `Covers ${periodMonths} months` : null,
        created_by: user.id,
      });
    }

    if (!bills.length) {
      return { success: false, message: "This period overlaps existing maintenance bills for all active flats" };
    }

    const { error } = await supabase.from("maintenance_bills").upsert(bills, {
      onConflict: "flat_id,bill_month,bill_year",
      ignoreDuplicates: true,
    });

    if (error) throw error;

    revalidatePath("/maintenance");
    revalidatePath("/dashboard");
    return {
      success: true,
      message: `Generated ${periodMonths}-month maintenance for ${bills.length} flats${skippedOverlaps ? `; skipped ${skippedOverlaps} overlapping flats` : ""}`,
    };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to generate maintenance bills"),
    };
  }
}

export async function addMaintenancePaymentAction(input: unknown, confirmed = false): Promise<ActionResult> {
  const parsed = maintenancePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { society, user } = await requireSocietyRole(FINANCE_ROLES);
    const dateWarning = financialYearWarning(parsed.data.payment_date);
    if (dateWarning && !confirmed) return { success: false, requiresConfirmation: true, message: dateWarning };

    const { data: bill, error: billError } = await supabase
      .from("maintenance_bills")
      .select("*")
      .eq("id", parsed.data.bill_id)
      .eq("society_id", society.id)
      .single();

    if (billError || !bill) throw billError || new Error("Bill not found");

    const paymentAmount = parsed.data.amount;
    if (paymentAmount > Number(bill.pending_amount)) {
      return { success: false, message: "Payment exceeds pending amount" };
    }
    if (Number(bill.pending_amount) <= 0) return { success: false, message: "This bill has no pending balance" };

    const { error: paymentError } = await supabase.from("maintenance_payments").insert({
      society_id: society.id,
      bill_id: bill.id,
      flat_id: bill.flat_id,
      amount: paymentAmount,
      payment_date: parsed.data.payment_date,
      payment_mode: parsed.data.payment_mode,
      reference_number: parsed.data.reference_number || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    });

    if (paymentError) throw paymentError;

    const paidAmount = Number(bill.paid_amount) + paymentAmount;
    const pendingAmount = Math.max(Number(bill.total_amount) - paidAmount, 0);
    const status = resolveStatus(Number(bill.total_amount), paidAmount, bill.due_date);

    const { error: updateError } = await supabase
      .from("maintenance_bills")
      .update({
        paid_amount: paidAmount,
        pending_amount: pendingAmount,
        payment_date: parsed.data.payment_date,
        status,
      })
      .eq("id", bill.id)
      .eq("society_id", society.id);

    if (updateError) throw updateError;

    // Mirror maintenance collection into income for balance accuracy
    const { data: maintenanceCategory } = await supabase
      .from("income_categories")
      .select("id")
      .eq("slug", "maintenance")
      .is("society_id", null)
      .maybeSingle();

    if (maintenanceCategory) {
      await supabase.from("income_transactions").insert({
        society_id: society.id,
        category_id: maintenanceCategory.id,
        flat_id: bill.flat_id,
        transaction_date: parsed.data.payment_date,
        person_name: "Maintenance payment",
        amount: paymentAmount,
        payment_mode: parsed.data.payment_mode,
        reference_number: parsed.data.reference_number || null,
        description: `Maintenance ${bill.bill_month}/${bill.bill_year}`,
        created_by: user.id,
      });
    }

    revalidatePath("/maintenance");
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, message: "Payment recorded" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to record payment") };
  }
}

export async function undoLastMaintenancePaymentAction(billId: string): Promise<ActionResult> {
  if (!billId) return { success: false, message: "Bill is required" };

  try {
    const supabase = await createClient();
    const { society } = await requireSocietyRole(DELETE_FINANCE_ROLES);

    const { data: bill, error: billError } = await supabase
      .from("maintenance_bills")
      .select("*")
      .eq("id", billId)
      .eq("society_id", society.id)
      .single();

    if (billError || !bill) throw billError || new Error("Bill not found");

    const { data: payment, error: paymentError } = await supabase
      .from("maintenance_payments")
      .select("*")
      .eq("bill_id", bill.id)
      .eq("society_id", society.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return { success: false, message: "No payment found to undo" };

    const { error: deletePaymentError } = await supabase
      .from("maintenance_payments")
      .delete()
      .eq("id", payment.id)
      .eq("society_id", society.id);

    if (deletePaymentError) throw deletePaymentError;

    const { data: remainingPayments, error: remainingError } = await supabase
      .from("maintenance_payments")
      .select("amount, payment_date, created_at")
      .eq("bill_id", bill.id)
      .eq("society_id", society.id)
      .order("created_at", { ascending: false });

    if (remainingError) throw remainingError;

    const paidAmount = (remainingPayments || []).reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const pendingAmount = Math.max(Number(bill.total_amount) - paidAmount, 0);
    const status = resolveStatus(Number(bill.total_amount), paidAmount, bill.due_date);
    const latestPaymentDate = remainingPayments?.[0]?.payment_date ?? null;

    const { error: updateError } = await supabase
      .from("maintenance_bills")
      .update({
        paid_amount: paidAmount,
        pending_amount: pendingAmount,
        payment_date: latestPaymentDate,
        status,
      })
      .eq("id", bill.id)
      .eq("society_id", society.id);

    if (updateError) throw updateError;

    // Remove the income entry created alongside this maintenance payment.
    const { data: maintenanceCategory } = await supabase
      .from("income_categories")
      .select("id")
      .eq("slug", "maintenance")
      .is("society_id", null)
      .maybeSingle();

    if (maintenanceCategory) {
      const { data: matchingIncome } = await supabase
        .from("income_transactions")
        .select("id")
        .eq("society_id", society.id)
        .eq("category_id", maintenanceCategory.id)
        .eq("flat_id", bill.flat_id)
        .eq("transaction_date", payment.payment_date)
        .eq("amount", payment.amount)
        .eq("description", `Maintenance ${bill.bill_month}/${bill.bill_year}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchingIncome) {
        const { error: deleteIncomeError } = await supabase
          .from("income_transactions")
          .delete()
          .eq("id", matchingIncome.id)
          .eq("society_id", society.id);

        if (deleteIncomeError) throw deleteIncomeError;
      }
    }

    revalidatePath("/maintenance");
    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return { success: true, message: "Last payment undone" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to undo payment") };
  }
}
