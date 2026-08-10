import { createClient } from "@/lib/supabase/server";
import type { Society } from "@/types/database";

/** Returns the primary society for this Phase-1 single-society app. */
export async function getPrimarySociety(): Promise<Society | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("societies")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function requireSociety(): Promise<Society> {
  const society = await getPrimarySociety();
  if (!society) {
    throw new Error("No society found. Please create one in Settings first.");
  }
  return society;
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
