"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireSociety } from "@/lib/society";
import { expenseSchema } from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils";

export type ActionResult = { success: boolean; message?: string };

export async function createExpenseAction(input: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const society = await requireSociety();
    const user = await getCurrentUser();

    const { error } = await supabase.from("expense_transactions").insert({
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
      created_by: user?.id ?? null,
    });

    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, message: "Expense added" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to add expense") };
  }
}

export async function updateExpenseAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
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
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, message: "Expense updated" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to update expense") };
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("expense_transactions").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, message: "Expense deleted" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to delete expense") };
  }
}
