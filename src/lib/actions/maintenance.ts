"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireSociety } from "@/lib/society";
import {
  generateMaintenanceSchema,
  maintenancePaymentSchema,
} from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils";
import type { MaintenanceStatus } from "@/types/database";

export type ActionResult = { success: boolean; message?: string };

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
    const society = await requireSociety();
    const user = await getCurrentUser();

    const { data: settings } = await supabase
      .from("maintenance_settings")
      .select("*")
      .eq("society_id", society.id)
      .maybeSingle();

    const amount = parsed.data.amount;
    const lateFeeDefault = parsed.data.late_fee ?? settings?.late_fee ?? 0;
    const dueDay = settings?.due_day ?? 10;

    const { data: flats, error: flatsError } = await supabase
      .from("flats")
      .select("id")
      .eq("society_id", society.id)
      .eq("status", "active");

    if (flatsError) throw flatsError;
    if (!flats?.length) {
      return { success: false, message: "No active flats found" };
    }

    const dueDate = new Date(parsed.data.bill_year, parsed.data.bill_month - 1, dueDay)
      .toISOString()
      .slice(0, 10);

    const bills = [];

    for (const flat of flats) {
      const { data: previous } = await supabase
        .from("maintenance_bills")
        .select("pending_amount")
        .eq("flat_id", flat.id)
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
        maintenance_amount: amount,
        previous_outstanding: previousOutstanding,
        late_fee: lateFeeDefault,
        total_amount: total,
        paid_amount: 0,
        pending_amount: total,
        due_date: dueDate,
        status: "pending" as const,
        created_by: user?.id ?? null,
      });
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
      message: `Generated maintenance for ${bills.length} flats`,
    };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to generate maintenance bills"),
    };
  }
}

export async function addMaintenancePaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = maintenancePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const society = await requireSociety();
    const user = await getCurrentUser();

    const { data: bill, error: billError } = await supabase
      .from("maintenance_bills")
      .select("*")
      .eq("id", parsed.data.bill_id)
      .single();

    if (billError || !bill) throw billError || new Error("Bill not found");

    const paymentAmount = parsed.data.amount;
    if (paymentAmount > Number(bill.pending_amount)) {
      return { success: false, message: "Payment exceeds pending amount" };
    }

    const { error: paymentError } = await supabase.from("maintenance_payments").insert({
      society_id: society.id,
      bill_id: bill.id,
      flat_id: bill.flat_id,
      amount: paymentAmount,
      payment_date: parsed.data.payment_date,
      payment_mode: parsed.data.payment_mode,
      reference_number: parsed.data.reference_number || null,
      notes: parsed.data.notes || null,
      created_by: user?.id ?? null,
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
      .eq("id", bill.id);

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
        created_by: user?.id ?? null,
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
