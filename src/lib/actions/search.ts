"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, requireSociety } from "@/lib/society";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

export type GlobalSearchHitType = "flat" | "income" | "expense" | "maintenance" | "event";
export type GlobalSearchHit = { id: string; type: GlobalSearchHitType; title: string; subtitle: string; href: string; amountLabel?: string };
export type SearchResult = { success: boolean; message?: string; results?: GlobalSearchHit[] };

const clean = (raw: string) => raw.trim().replace(/[%_,()\"]/g, " ").replace(/\s+/g, " ").slice(0, 80);
const ilike = (column: string, q: string) => `${column}.ilike."%${q}%"`;
const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] : value;
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export async function searchGlobalAction(rawQuery: string): Promise<SearchResult> {
  const q = clean(rawQuery);
  if (!q) return { success: true, results: [] };
  try {
    await requireCurrentUser();
    const society = await requireSociety();
    const supabase = await createClient();

    const flats = await supabase.from("flats")
      .select("id, flat_number, owner_name, resident_name, mobile_number, wing:wings(name)")
      .eq("society_id", society.id)
      .or(["flat_number", "owner_name", "resident_name", "mobile_number"].map((field) => ilike(field, q)).join(","))
      .order("flat_number").limit(8);
    if (flats.error) throw flats.error;

    const flatIds = (flats.data || []).map((flat) => flat.id);
    const maintenanceFilters = [ilike("receipt_number", q), ilike("reference_number", q)];
    const eventPaymentFilters = [ilike("reference_number", q)];
    if (flatIds.length) {
      const flatFilter = `flat_id.in.(${flatIds.join(",")})`;
      maintenanceFilters.push(flatFilter);
      eventPaymentFilters.push(flatFilter);
    }
    const billFilters = flatIds.length ? [`flat_id.in.(${flatIds.join(",")})`] : [];
    const year = q.match(/\b(20[0-9]{2})\b/)?.[1];
    const numericMonth = q.match(/\b(0?[1-9]|1[0-2])[\/-](20[0-9]{2})\b/);
    const namedMonth = monthNames.findIndex((name) => q.toLowerCase().includes(name));
    if (numericMonth) billFilters.push(`and(bill_month.eq.${Number(numericMonth[1])},bill_year.eq.${numericMonth[2]})`);
    else if (year && namedMonth >= 0) billFilters.push(`and(bill_month.eq.${namedMonth + 1},bill_year.eq.${year})`);
    else if (year) billFilters.push(`bill_year.eq.${year}`);
    const normalizedStatus = q.toLowerCase().replaceAll(" ", "_");
    if (["paid", "pending", "partially_paid", "overdue"].includes(normalizedStatus)) billFilters.push(`status.eq.${normalizedStatus}`);
    const eventFilters = [ilike("name", q), ilike("description", q)];
    if (/^[0-9]{4}$/.test(q)) eventFilters.push(`event_year.eq.${q}`);

    const responses = await Promise.all([
      supabase.from("income_transactions").select("id, receipt_number, person_name, amount, flat_id, flat:flats(flat_number), category:income_categories(name)").eq("society_id", society.id).eq("status", "active").or(["receipt_number", "person_name", "description", "reference_number"].map((field) => ilike(field, q)).join(",")).order("transaction_date", { ascending: false }).limit(8),
      supabase.from("expense_transactions").select("id, voucher_number, vendor_name, amount, bill_number, category:expense_categories(name)").eq("society_id", society.id).eq("status", "active").or(["voucher_number", "vendor_name", "bill_number", "description", "reference_number"].map((field) => ilike(field, q)).join(",")).order("transaction_date", { ascending: false }).limit(8),
      supabase.from("maintenance_payments").select("id, receipt_number, reference_number, amount, flat_id, flat:flats(flat_number, owner_name, resident_name)").eq("society_id", society.id).or(maintenanceFilters.join(",")).order("payment_date", { ascending: false }).limit(8),
      billFilters.length ? supabase.from("maintenance_bills").select("id, flat_id, bill_month, bill_year, period_months, pending_amount, status, flat:flats(flat_number, owner_name, resident_name)").eq("society_id", society.id).or(billFilters.join(",")).order("bill_year", { ascending: false }).order("bill_month", { ascending: false }).limit(8) : Promise.resolve({ data: [], error: null }),
      supabase.from("events").select("id, name, event_year, description").eq("society_id", society.id).or(eventFilters.join(",")).order("event_year", { ascending: false }).limit(8),
      supabase.from("event_contributions").select("id, event_id, contribution_type, category, donor_name, item_name, amount, total_value, event:events(name, event_year)").eq("society_id", society.id).or(["category", "donor_name", "mobile_number", "item_name", "reference_number", "notes"].map((field) => ilike(field, q)).join(",")).order("contribution_date", { ascending: false }).limit(8),
      supabase.from("event_expenses").select("id, event_id, category, vendor_name, amount, event:events(name, event_year)").eq("society_id", society.id).or(["category", "vendor_name", "reference_number", "notes"].map((field) => ilike(field, q)).join(",")).order("expense_date", { ascending: false }).limit(8),
      supabase.from("event_flat_payments").select("id, event_id, flat_id, amount, reference_number, flat:flats(flat_number), event:events(name, event_year)").eq("society_id", society.id).or(eventPaymentFilters.join(",")).order("payment_date", { ascending: false }).limit(8),
    ]);
    for (const response of responses) if (response.error) throw response.error;
    const [income, expenses, payments, bills, events, aavak, eventExpenses, eventPayments] = responses;
    const results: GlobalSearchHit[] = [];

    for (const flat of flats.data || []) {
      const wing = one(flat.wing as { name?: string } | { name?: string }[] | null);
      results.push({ id: `flat-${flat.id}`, type: "flat", title: flat.flat_number, subtitle: [wing?.name ? `Wing ${wing.name}` : null, flat.owner_name || flat.resident_name || "No owner/resident", flat.mobile_number].filter(Boolean).join(" • "), href: `/society/flats/${flat.id}` });
    }
    for (const row of income.data || []) {
      const flat = one(row.flat as { flat_number?: string } | { flat_number?: string }[] | null);
      const category = one(row.category as { name?: string } | { name?: string }[] | null);
      results.push({ id: `income-${row.id}`, type: "income", title: row.receipt_number || "Income receipt", subtitle: [row.person_name, flat?.flat_number ? `Flat ${flat.flat_number}` : null, category?.name].filter(Boolean).join(" • "), href: row.flat_id ? `/society/flats/${row.flat_id}` : `/income?search=${encodeURIComponent(row.receipt_number || q)}`, amountLabel: formatCurrency(row.amount) });
    }
    for (const row of expenses.data || []) {
      const category = one(row.category as { name?: string } | { name?: string }[] | null);
      results.push({ id: `expense-${row.id}`, type: "expense", title: row.voucher_number || row.vendor_name || "Expense voucher", subtitle: [row.vendor_name, category?.name, row.bill_number ? `Bill ${row.bill_number}` : null].filter(Boolean).join(" • "), href: `/expenses?search=${encodeURIComponent(row.voucher_number || row.vendor_name || q)}`, amountLabel: formatCurrency(row.amount) });
    }
    for (const row of payments.data || []) {
      const flat = one(row.flat as { flat_number?: string; owner_name?: string; resident_name?: string } | { flat_number?: string; owner_name?: string; resident_name?: string }[] | null);
      results.push({ id: `maintenance-${row.id}`, type: "maintenance", title: row.receipt_number || "Maintenance receipt", subtitle: [flat?.flat_number ? `Flat ${flat.flat_number}` : null, flat?.owner_name || flat?.resident_name, row.reference_number ? `Ref ${row.reference_number}` : null].filter(Boolean).join(" • ") || "Maintenance payment", href: row.flat_id ? `/society/flats/${row.flat_id}` : "/maintenance", amountLabel: formatCurrency(row.amount) });
    }
    for (const row of bills.data || []) {
      const flat = one(row.flat as { flat_number?: string; owner_name?: string; resident_name?: string } | { flat_number?: string; owner_name?: string; resident_name?: string }[] | null);
      results.push({ id: `maintenance-bill-${row.id}`, type: "maintenance", title: `Maintenance bill • Flat ${flat?.flat_number || "—"}`, subtitle: [`${row.bill_month}/${row.bill_year} (${row.period_months || 1} month period)`, flat?.owner_name || flat?.resident_name, row.status.replaceAll("_", " ")].filter(Boolean).join(" • "), href: `/maintenance?search=${encodeURIComponent(flat?.flat_number || q)}`, amountLabel: formatCurrency(row.pending_amount) });
    }
    for (const row of events.data || []) results.push({ id: `event-${row.id}`, type: "event", title: `${row.name} ${row.event_year}`, subtitle: row.description || "Event Hisab", href: `/events?event=${row.id}` });
    for (const row of aavak.data || []) {
      const event = one(row.event as { name?: string; event_year?: number } | { name?: string; event_year?: number }[] | null);
      results.push({ id: `event-aavak-${row.id}`, type: "event", title: row.contribution_type === "item" ? row.item_name || row.category : row.donor_name || row.category, subtitle: [`${event?.name || "Event"} ${event?.event_year || ""}`.trim(), row.category, row.donor_name].filter(Boolean).join(" • "), href: `/events?event=${row.event_id}`, amountLabel: formatCurrency(row.contribution_type === "item" ? row.total_value : row.amount || 0) });
    }
    for (const row of eventExpenses.data || []) {
      const event = one(row.event as { name?: string; event_year?: number } | { name?: string; event_year?: number }[] | null);
      results.push({ id: `event-expense-${row.id}`, type: "event", title: row.vendor_name || row.category, subtitle: [`${event?.name || "Event"} ${event?.event_year || ""}`.trim(), row.category, "Javak"].join(" • "), href: `/events?event=${row.event_id}`, amountLabel: formatCurrency(row.amount) });
    }
    for (const row of eventPayments.data || []) {
      const event = one(row.event as { name?: string; event_year?: number } | { name?: string; event_year?: number }[] | null);
      const flat = one(row.flat as { flat_number?: string } | { flat_number?: string }[] | null);
      results.push({ id: `event-payment-${row.id}`, type: "event", title: row.reference_number || `Flat ${flat?.flat_number || "—"} contribution`, subtitle: [`${event?.name || "Event"} ${event?.event_year || ""}`.trim(), flat?.flat_number ? `Flat ${flat.flat_number}` : null].filter(Boolean).join(" • "), href: `/events?event=${row.event_id}`, amountLabel: formatCurrency(row.amount) });
    }
    return { success: true, results };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Search failed"), results: [] };
  }
}
