"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety, requireCurrentUser, requireRecentAuthentication, requireSocietyRole, SETTINGS_ROLES } from "@/lib/society";
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
    await requireRecentAuthentication();
    const supabase = await createClient();
    const user = await requireCurrentUser();
    const existing = await getPrimarySociety();

    if (existing) {
      await requireSocietyRole(SETTINGS_ROLES);
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
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("maintenance_settings").insert({
        society_id: society.id,
        default_amount: 1500,
        use_due_date: true,
        due_day: 10,
        late_fee: 100,
        billing_frequency_months: 1,
        created_by: user.id,
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
    await requireRecentAuthentication();
    const supabase = await createClient();
    const { society, user } = await requireSocietyRole(SETTINGS_ROLES);

    const { data: existing } = await supabase
      .from("maintenance_settings")
      .select("id")
      .eq("society_id", society.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("maintenance_settings")
        .update(parsed.data)
        .eq("id", existing.id)
        .eq("society_id", society.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("maintenance_settings").insert({
        society_id: society.id,
        ...parsed.data,
        created_by: user.id,
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
