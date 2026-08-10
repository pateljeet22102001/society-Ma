"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireSociety } from "@/lib/society";
import { flatSchema } from "@/lib/validations/society";
import { getErrorMessage } from "@/lib/utils";

export type ActionResult = { success: boolean; message?: string };

export async function createFlatAction(input: unknown): Promise<ActionResult> {
  const parsed = flatSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const society = await requireSociety();
    const user = await getCurrentUser();

    const { error } = await supabase.from("flats").insert({
      society_id: society.id,
      wing_id: parsed.data.wing_id,
      flat_number: parsed.data.flat_number.toUpperCase(),
      owner_name: parsed.data.owner_name || null,
      resident_name: parsed.data.resident_name || null,
      mobile_number: parsed.data.mobile_number || null,
      email: parsed.data.email || null,
      occupancy_type: parsed.data.occupancy_type,
      members_count: parsed.data.members_count,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      created_by: user?.id ?? null,
    });

    if (error) throw error;

    const { count } = await supabase
      .from("flats")
      .select("*", { count: "exact", head: true })
      .eq("wing_id", parsed.data.wing_id);

    await supabase
      .from("wings")
      .update({ total_flats: count || 0 })
      .eq("id", parsed.data.wing_id);

    revalidatePath("/society/flats");
    revalidatePath("/society/wings");
    revalidatePath("/dashboard");
    return { success: true, message: "Flat added" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to add flat") };
  }
}

export async function updateFlatAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = flatSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("flats")
      .update({
        wing_id: parsed.data.wing_id,
        flat_number: parsed.data.flat_number.toUpperCase(),
        owner_name: parsed.data.owner_name || null,
        resident_name: parsed.data.resident_name || null,
        mobile_number: parsed.data.mobile_number || null,
        email: parsed.data.email || null,
        occupancy_type: parsed.data.occupancy_type,
        members_count: parsed.data.members_count,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/society/flats");
    return { success: true, message: "Flat updated" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to update flat") };
  }
}

export async function toggleFlatStatusAction(
  id: string,
  status: "active" | "inactive",
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("flats").update({ status }).eq("id", id);
    if (error) throw error;
    revalidatePath("/society/flats");
    revalidatePath("/dashboard");
    return { success: true, message: `Flat marked as ${status}` };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to update status") };
  }
}

export async function deleteFlatAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: flat } = await supabase.from("flats").select("wing_id").eq("id", id).single();
    const { error } = await supabase.from("flats").delete().eq("id", id);
    if (error) throw error;

    if (flat?.wing_id) {
      const { count } = await supabase
        .from("flats")
        .select("*", { count: "exact", head: true })
        .eq("wing_id", flat.wing_id);
      await supabase.from("wings").update({ total_flats: count || 0 }).eq("id", flat.wing_id);
    }

    revalidatePath("/society/flats");
    revalidatePath("/society/wings");
    revalidatePath("/dashboard");
    return { success: true, message: "Flat deleted" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to delete flat") };
  }
}
