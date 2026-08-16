import { createClient } from "@/lib/supabase/server";
import type { Society, SocietyMemberRole } from "@/types/database";
import { cookies } from "next/headers";

export const FINANCE_ROLES: readonly SocietyMemberRole[] = [
  "admin", "chairman", "treasurer", "operator",
];
export const DELETE_FINANCE_ROLES: readonly SocietyMemberRole[] = [
  "admin", "chairman", "treasurer",
];
export const SETTINGS_ROLES: readonly SocietyMemberRole[] = ["admin", "chairman"];

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

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized. Please sign in again.");
  return user;
}

/** Requires a password confirmation completed during the previous 10 minutes. */
export async function requireRecentAuthentication() {
  const user = await requireCurrentUser();
  const value = (await cookies()).get("society_recent_auth")?.value;
  const [userId, confirmedAt] = value?.split(":") || [];
  if (userId !== user.id || Date.now() - Number(confirmedAt) > 10 * 60 * 1000) {
    throw new Error("PASSWORD_CONFIRMATION_REQUIRED");
  }
  return user;
}

/** Authorizes a Server Action independently from page and database RLS checks. */
export async function requireSocietyRole(allowedRoles: readonly SocietyMemberRole[]) {
  const user = await requireCurrentUser();
  const society = await requireSociety();
  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("society_members")
    .select("role,status")
    .eq("society_id", society.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership || !allowedRoles.includes(membership.role as SocietyMemberRole)) {
    throw new Error("Forbidden. You do not have permission for this action.");
  }

  return { society, user, role: membership.role as SocietyMemberRole };
}
