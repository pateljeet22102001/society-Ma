"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireSociety } from "@/lib/society";
import { incomeSchema } from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils";

export type ActionResult = { success: boolean; message?: string };

export async function createIncomeAction(input: unknown): Promise<ActionResult> {
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const society = await requireSociety();
    const user = await getCurrentUser();

    const { error } = await supabase.from("income_transactions").insert({
      society_id: society.id,
      category_id: parsed.data.category_id,
      flat_id: parsed.data.flat_id || null,
      transaction_date: parsed.data.transaction_date,
      person_name: parsed.data.person_name || null,
      amount: parsed.data.amount,
      payment_mode: parsed.data.payment_mode,
      reference_number: parsed.data.reference_number || null,
      description: parsed.data.description || null,
      receipt_number: parsed.data.receipt_number || null,
      created_by: user?.id ?? null,
    });

    if (error) throw error;
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, message: "Income added" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to add income") };
  }
}

export async function updateIncomeAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("income_transactions")
      .update({
        category_id: parsed.data.category_id,
        flat_id: parsed.data.flat_id || null,
        transaction_date: parsed.data.transaction_date,
        person_name: parsed.data.person_name || null,
        amount: parsed.data.amount,
        payment_mode: parsed.data.payment_mode,
        reference_number: parsed.data.reference_number || null,
        description: parsed.data.description || null,
        receipt_number: parsed.data.receipt_number || null,
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, message: "Income updated" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to update income") };
  }
}

export async function deleteIncomeAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("income_transactions").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, message: "Income deleted" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to delete income") };
  }
}
