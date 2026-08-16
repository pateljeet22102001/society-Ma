"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DELETE_FINANCE_ROLES, FINANCE_ROLES, requireSocietyRole } from "@/lib/society";
import { expenseCategorySchema, expenseSchema } from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils";
import { financialYearWarning } from "@/lib/financial-year";

export type ActionResult = { success: boolean; message?: string; requiresConfirmation?: boolean };

function categorySlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function createExpenseCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = expenseCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message };
  try {
    const supabase = await createClient(); const { society } = await requireSocietyRole(FINANCE_ROLES);
    const slug = categorySlug(parsed.data.name);
    if (!slug) return { success: false, message: "Enter a valid category name" };
    const { data: existing } = await supabase.from("expense_categories").select("id").or(`society_id.is.null,society_id.eq.${society.id}`).eq("slug", slug).limit(1).maybeSingle();
    if (existing) return { success: false, message: "This category already exists" };
    const { error } = await supabase.from("expense_categories").insert({ society_id: society.id, name: parsed.data.name.trim(), slug, is_system: false, status: "active" });
    if (error) throw error; revalidatePath("/expenses"); return { success: true, message: "Expense category added" };
  } catch (error) { return { success: false, message: getErrorMessage(error, "Failed to add category") }; }
}

export async function createExpenseAction(input: unknown, confirmed = false): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { society, user } = await requireSocietyRole(FINANCE_ROLES);
    const warnings: string[] = [];
    const dateWarning = financialYearWarning(parsed.data.transaction_date);
    if (dateWarning) warnings.push(dateWarning);
    const bill = parsed.data.bill_number?.trim();
    if (bill) {
      const { data: duplicate } = await supabase.from("expense_transactions").select("id").eq("society_id", society.id).ilike("bill_number", bill).limit(1).maybeSingle();
      if (duplicate) warnings.push(`Bill number "${bill}" already exists.`);
    }
    if (warnings.length && !confirmed) return { success: false, requiresConfirmation: true, message: `${warnings.join(" ")} Continue anyway?` };

    const { data: created, error } = await supabase.from("expense_transactions").insert({
      society_id: society.id,
      category_id: parsed.data.category_id,
      transaction_date: parsed.data.transaction_date,
      vendor_name: parsed.data.vendor_name || null,
      amount: parsed.data.amount,
      payment_mode: parsed.data.payment_mode,
      reference_number: parsed.data.reference_number || null,
      description: parsed.data.description || null,
      bill_number: parsed.data.bill_number || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    }).select("voucher_number").single();

    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, message: created?.voucher_number ? `Expense added · ${created.voucher_number}` : "Expense added" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to add expense") };
  }
}

export async function updateExpenseAction(id: string, input: unknown, confirmed = false): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { society } = await requireSocietyRole(FINANCE_ROLES);
    const warnings: string[] = [];
    const dateWarning = financialYearWarning(parsed.data.transaction_date);
    if (dateWarning) warnings.push(dateWarning);
    const bill = parsed.data.bill_number?.trim();
    if (bill) {
      const { data: duplicate } = await supabase.from("expense_transactions").select("id").eq("society_id", society.id).ilike("bill_number", bill).neq("id", id).limit(1).maybeSingle();
      if (duplicate) warnings.push(`Bill number "${bill}" already exists.`);
    }
    if (warnings.length && !confirmed) return { success: false, requiresConfirmation: true, message: `${warnings.join(" ")} Continue anyway?` };
    const { error } = await supabase
      .from("expense_transactions")
      .update({
        category_id: parsed.data.category_id,
        transaction_date: parsed.data.transaction_date,
        vendor_name: parsed.data.vendor_name || null,
        amount: parsed.data.amount,
        payment_mode: parsed.data.payment_mode,
        reference_number: parsed.data.reference_number || null,
        description: parsed.data.description || null,
        bill_number: parsed.data.bill_number || null,
        notes: parsed.data.notes || null,
      })
      .eq("id", id)
      .eq("society_id", society.id);

    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, message: "Expense updated" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to update expense") };
  }
}

export async function deleteExpenseAction(id: string, reason: string): Promise<ActionResult> {
  const cancellationReason = reason.trim();
  if (cancellationReason.length < 3) return { success: false, message: "Enter a cancellation reason" };
  try {
    const supabase = await createClient();
    const { society, user } = await requireSocietyRole(DELETE_FINANCE_ROLES);
    const { error } = await supabase.from("expense_transactions").update({ status: "inactive", cancelled_at: new Date().toISOString(), cancelled_by: user.id, cancellation_reason: cancellationReason }).eq("id", id).eq("society_id", society.id).eq("status", "active");
    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, message: "Expense voucher voided" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to delete expense") };
  }
}
