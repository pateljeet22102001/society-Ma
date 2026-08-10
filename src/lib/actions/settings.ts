"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPrimarySociety } from "@/lib/society";
import {
  maintenanceSettingsSchema,
  societySettingsSchema,
} from "@/lib/validations/society";
import { getErrorMessage } from "@/lib/utils";

export type ActionResult = { success: boolean; message?: string };

export async function saveSocietySettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = societySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    const existing = await getPrimarySociety();

    if (existing) {
      const { error } = await supabase
        .from("societies")
        .update({
          ...parsed.data,
          email: parsed.data.email || null,
          logo_url: parsed.data.logo_url || null,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { data: society, error } = await supabase
        .from("societies")
        .insert({
          ...parsed.data,
          email: parsed.data.email || null,
          logo_url: parsed.data.logo_url || null,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("maintenance_settings").insert({
        society_id: society.id,
        default_amount: 1500,
        due_day: 10,
        late_fee: 100,
        created_by: user?.id ?? null,
      });
    }

    revalidatePath("/settings");
    revalidatePath("/society");
    revalidatePath("/dashboard");
    return { success: true, message: "Society settings saved" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to save settings") };
  }
}

export async function saveMaintenanceSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = maintenanceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const society = await getPrimarySociety();
    if (!society) {
      return { success: false, message: "Create society details first" };
    }
    const user = await getCurrentUser();

    const { data: existing } = await supabase
      .from("maintenance_settings")
      .select("id")
      .eq("society_id", society.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("maintenance_settings")
        .update(parsed.data)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("maintenance_settings").insert({
        society_id: society.id,
        ...parsed.data,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    }

    revalidatePath("/settings");
    revalidatePath("/maintenance");
    return { success: true, message: "Maintenance settings saved" };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to save maintenance settings"),
    };
  }
}
