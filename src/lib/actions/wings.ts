"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSociety, getCurrentUser } from "@/lib/society";
import { wingSchema } from "@/lib/validations/society";
import { generateFlatNumbers, getErrorMessage } from "@/lib/utils";

export type ActionResult = { success: boolean; message?: string };

export async function createWingAction(input: unknown): Promise<ActionResult> {
  const parsed = wingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const society = await requireSociety();
    const user = await getCurrentUser();

    const { data: wing, error } = await supabase
      .from("wings")
      .insert({
        society_id: society.id,
        name: parsed.data.name.toUpperCase(),
        total_flats: parsed.data.total_flats,
        description: parsed.data.description || null,
        status: parsed.data.status,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;

    const flats = generateFlatNumbers(wing.name, wing.total_flats).map((flat_number) => ({
      society_id: society.id,
      wing_id: wing.id,
      flat_number,
      occupancy_type: "vacant" as const,
      members_count: 0,
      status: "active" as const,
      created_by: user?.id ?? null,
    }));

    if (flats.length) {
      const { error: flatError } = await supabase.from("flats").insert(flats);
      if (flatError) throw flatError;
    }

    revalidatePath("/society/wings");
    revalidatePath("/society/flats");
    revalidatePath("/dashboard");
    return { success: true, message: `Wing ${wing.name} created with ${flats.length} flats` };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to create wing") };
  }
}

export async function updateWingAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = wingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("wings")
      .update({
        name: parsed.data.name.toUpperCase(),
        description: parsed.data.description || null,
        status: parsed.data.status,
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/society/wings");
    revalidatePath("/society/flats");
    return { success: true, message: "Wing updated" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to update wing") };
  }
}

export async function deleteWingAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("wings").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/society/wings");
    revalidatePath("/society/flats");
    revalidatePath("/dashboard");
    return { success: true, message: "Wing deleted" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Failed to delete wing") };
  }
}
