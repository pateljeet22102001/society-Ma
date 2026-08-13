"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireSociety } from "@/lib/society";
import { eventAavakSchema, eventExpenseSchema, eventPaymentSchema, eventSchema } from "@/lib/validations/events";
import { getErrorMessage } from "@/lib/utils";
import type { MaintenanceStatus } from "@/types/database";

type Result = { success: boolean; message?: string };
const refresh = () => revalidatePath("/events");
function status(total: number, paid: number, due?: string | null): MaintenanceStatus {
  if (paid >= total) return "paid";
  if (paid > 0) return "partially_paid";
  return due && new Date(`${due}T23:59:59`) < new Date() ? "overdue" : "pending";
}

export async function createEventAction(input: unknown): Promise<Result> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message };
  try {
    const supabase = await createClient(); const society = await requireSociety(); const user = await getCurrentUser();
    const { error } = await supabase.from("events").insert({ ...parsed.data, start_date: parsed.data.start_date || null, end_date: parsed.data.end_date || null, due_date: parsed.data.due_date || null, description: parsed.data.description || null, society_id: society.id, created_by: user?.id ?? null });
    if (error) throw error; refresh(); return { success: true, message: "Event created" };
  } catch (e) { return { success: false, message: getErrorMessage(e, "Failed to create event") }; }
}

export async function generateEventContributionsAction(eventId: string): Promise<Result> {
  try {
    const supabase = await createClient(); const society = await requireSociety();
    const { data: event, error: eventError } = await supabase.from("events").select("*").eq("id", eventId).eq("society_id", society.id).single();
    if (eventError || !event) throw eventError || new Error("Event not found");
    const { data: flats, error: flatsError } = await supabase.from("flats").select("id").eq("society_id", society.id).eq("status", "active");
    if (flatsError) throw flatsError; if (!flats?.length) return { success: false, message: "No active flats found" };
    const rows = flats.map((flat) => ({ event_id: event.id, society_id: society.id, flat_id: flat.id, amount: event.contribution_amount, paid_amount: 0, pending_amount: event.contribution_amount, due_date: event.due_date, status: status(Number(event.contribution_amount), 0, event.due_date) }));
    const { error } = await supabase.from("event_flat_contributions").upsert(rows, { onConflict: "event_id,flat_id", ignoreDuplicates: true });
    if (error) throw error; refresh(); return { success: true, message: `Contributions generated for ${flats.length} flats` };
  } catch (e) { return { success: false, message: getErrorMessage(e, "Failed to generate contributions") }; }
}

export async function addEventPaymentAction(input: unknown): Promise<Result> {
  const parsed = eventPaymentSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message };
  try {
    const supabase = await createClient(); const society = await requireSociety(); const user = await getCurrentUser();
    const { data: row, error } = await supabase.from("event_flat_contributions").select("*").eq("id", parsed.data.contribution_id).eq("society_id", society.id).single();
    if (error || !row) throw error || new Error("Contribution not found");
    if (parsed.data.amount > Number(row.pending_amount)) return { success: false, message: "Payment exceeds pending amount" };
    const { error: payError } = await supabase.from("event_flat_payments").insert({ contribution_id: row.id, event_id: row.event_id, society_id: society.id, flat_id: row.flat_id, ...parsed.data, reference_number: parsed.data.reference_number || null, created_by: user?.id ?? null });
    if (payError) throw payError;
    const paid = Number(row.paid_amount) + parsed.data.amount;
    const { error: updateError } = await supabase.from("event_flat_contributions").update({ paid_amount: paid, pending_amount: Math.max(Number(row.amount) - paid, 0), payment_date: parsed.data.payment_date, status: status(Number(row.amount), paid, row.due_date) }).eq("id", row.id);
    if (updateError) throw updateError; refresh(); return { success: true, message: "Event payment recorded" };
  } catch (e) { return { success: false, message: getErrorMessage(e, "Failed to record payment") }; }
}

export async function undoEventPaymentAction(contributionId: string): Promise<Result> {
  try {
    const supabase = await createClient(); const society = await requireSociety();
    const { data: row } = await supabase.from("event_flat_contributions").select("*").eq("id", contributionId).eq("society_id", society.id).single();
    if (!row) throw new Error("Contribution not found");
    const { data: payment } = await supabase.from("event_flat_payments").select("*").eq("contribution_id", row.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!payment) return { success: false, message: "No payment found to undo" };
    const { error: deleteError } = await supabase.from("event_flat_payments").delete().eq("id", payment.id); if (deleteError) throw deleteError;
    const { data: remaining } = await supabase.from("event_flat_payments").select("amount,payment_date,created_at").eq("contribution_id", row.id).order("created_at", { ascending: false });
    const paid = (remaining || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const { error } = await supabase.from("event_flat_contributions").update({ paid_amount: paid, pending_amount: Math.max(Number(row.amount) - paid, 0), payment_date: remaining?.[0]?.payment_date ?? null, status: status(Number(row.amount), paid, row.due_date) }).eq("id", row.id);
    if (error) throw error; refresh(); return { success: true, message: "Last payment undone" };
  } catch (e) { return { success: false, message: getErrorMessage(e, "Failed to undo payment") }; }
}

export async function addEventAavakAction(input: unknown): Promise<Result> {
  const parsed = eventAavakSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message };
  try {
    const supabase = await createClient(); const society = await requireSociety(); const user = await getCurrentUser(); const d = parsed.data;
    const total = d.contribution_type === "money" ? Number(d.amount) : Number(d.quantity) * Number(d.unit_price || 0);
    const { error } = await supabase.from("event_contributions").insert({ ...d, society_id: society.id, amount: d.contribution_type === "money" ? d.amount : null, payment_mode: d.contribution_type === "money" ? d.payment_mode : null, item_name: d.contribution_type === "item" ? d.item_name : null, quantity: d.contribution_type === "item" ? d.quantity : null, unit: d.contribution_type === "item" ? d.unit : null, unit_price: d.contribution_type === "item" ? d.unit_price : null, total_value: total, created_by: user?.id ?? null });
    if (error) throw error; refresh(); return { success: true, message: "Event Aavak added" };
  } catch (e) { return { success: false, message: getErrorMessage(e, "Failed to add Aavak") }; }
}

export async function addEventExpenseAction(input: unknown): Promise<Result> {
  const parsed = eventExpenseSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message };
  try {
    const supabase = await createClient(); const society = await requireSociety(); const user = await getCurrentUser();
    const { error } = await supabase.from("event_expenses").insert({ ...parsed.data, society_id: society.id, created_by: user?.id ?? null });
    if (error) throw error; refresh(); return { success: true, message: "Event expense added" };
  } catch (e) { return { success: false, message: getErrorMessage(e, "Failed to add expense") }; }
}

export async function deleteEventRecordAction(table: "event_contributions" | "event_expenses", id: string): Promise<Result> {
  try { const supabase = await createClient(); const society = await requireSociety(); const { error } = await supabase.from(table).delete().eq("id", id).eq("society_id", society.id); if (error) throw error; refresh(); return { success: true, message: "Record deleted" }; }
  catch (e) { return { success: false, message: getErrorMessage(e, "Failed to delete record") }; }
}
