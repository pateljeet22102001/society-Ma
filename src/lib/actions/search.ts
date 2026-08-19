"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, requireSociety } from "@/lib/society";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

export type GlobalSearchHitType = "flat" | "income" | "expense" | "maintenance";

export type GlobalSearchHit = {
  id: string;
  type: GlobalSearchHitType;
  title: string;
  subtitle: string;
  href: string;
  amountLabel?: string;
};

export type SearchResult = {
  success: boolean;
  message?: string;
  results?: GlobalSearchHit[];
};

function sanitizeQuery(raw: string) {
  return raw.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

function likePattern(q: string) {
  return `%${q}%`;
}

function orLike(column: string, q: string) {
  // Quote value for PostgREST .or() filter safety
  return `${column}.ilike."%${q}%"`;
}

export async function searchGlobalAction(rawQuery: string): Promise<SearchResult> {
  const q = sanitizeQuery(rawQuery);
  if (q.length < 1) return { success: true, results: [] };

  try {
    await requireCurrentUser();
    const society = await requireSociety();
    const supabase = await createClient();
    const like = likePattern(q);

    const [flatsRes, incomeRes, expenseRes, maintenanceRes] = await Promise.all([
      supabase
        .from("flats")
        .select("id, flat_number, owner_name, resident_name, mobile_number, wing:wings(name)")
        .eq("society_id", society.id)
        .or(
          [orLike("flat_number", q), orLike("owner_name", q), orLike("resident_name", q), orLike("mobile_number", q)].join(
            ",",
          ),
        )
        .order("flat_number")
        .limit(8),
      supabase
        .from("income_transactions")
        .select(
          "id, receipt_number, person_name, amount, transaction_date, flat_id, flat:flats(flat_number), category:income_categories(name)",
        )
        .eq("society_id", society.id)
        .eq("status", "active")
        .or(
          [
            orLike("receipt_number", q),
            orLike("person_name", q),
            orLike("description", q),
            orLike("reference_number", q),
          ].join(","),
        )
        .order("transaction_date", { ascending: false })
        .limit(8),
      supabase
        .from("expense_transactions")
        .select(
          "id, voucher_number, vendor_name, amount, transaction_date, bill_number, category:expense_categories(name)",
        )
        .eq("society_id", society.id)
        .eq("status", "active")
        .or(
          [
            orLike("voucher_number", q),
            orLike("vendor_name", q),
            orLike("bill_number", q),
            orLike("description", q),
            orLike("reference_number", q),
          ].join(","),
        )
        .order("transaction_date", { ascending: false })
        .limit(8),
      supabase
        .from("maintenance_payments")
        .select("id, receipt_number, amount, payment_date, flat_id, flat:flats(flat_number)")
        .eq("society_id", society.id)
        .ilike("receipt_number", like)
        .order("payment_date", { ascending: false })
        .limit(8),
    ]);

    if (flatsRes.error) throw flatsRes.error;
    if (incomeRes.error) throw incomeRes.error;
    if (expenseRes.error) throw expenseRes.error;
    if (maintenanceRes.error) throw maintenanceRes.error;

    const results: GlobalSearchHit[] = [];

    for (const flat of flatsRes.data || []) {
      const wing = flat.wing as { name?: string } | { name?: string }[] | null;
      const wingName = Array.isArray(wing) ? wing[0]?.name : wing?.name;
      const people = [flat.owner_name, flat.resident_name].filter(Boolean).join(" · ");
      results.push({
        id: `flat-${flat.id}`,
        type: "flat",
        title: flat.flat_number,
        subtitle: [wingName ? `Wing ${wingName}` : null, people || "No owner/resident", flat.mobile_number]
          .filter(Boolean)
          .join(" · "),
        href: `/society/flats/${flat.id}`,
      });
    }

    for (const row of incomeRes.data || []) {
      const flat = row.flat as { flat_number?: string } | { flat_number?: string }[] | null;
      const category = row.category as { name?: string } | { name?: string }[] | null;
      const flatNumber = Array.isArray(flat) ? flat[0]?.flat_number : flat?.flat_number;
      const categoryName = Array.isArray(category) ? category[0]?.name : category?.name;
      results.push({
        id: `income-${row.id}`,
        type: "income",
        title: row.receipt_number || "Income receipt",
        subtitle: [row.person_name, flatNumber ? `Flat ${flatNumber}` : null, categoryName]
          .filter(Boolean)
          .join(" · "),
        href: row.flat_id
          ? `/society/flats/${row.flat_id}`
          : `/income?search=${encodeURIComponent(row.receipt_number || q)}`,
        amountLabel: formatCurrency(row.amount),
      });
    }

    for (const row of expenseRes.data || []) {
      const category = row.category as { name?: string } | { name?: string }[] | null;
      const categoryName = Array.isArray(category) ? category[0]?.name : category?.name;
      results.push({
        id: `expense-${row.id}`,
        type: "expense",
        title: row.voucher_number || row.vendor_name || "Expense voucher",
        subtitle: [row.vendor_name, categoryName, row.bill_number ? `Bill ${row.bill_number}` : null]
          .filter(Boolean)
          .join(" · "),
        href: `/expenses?search=${encodeURIComponent(row.voucher_number || row.vendor_name || q)}`,
        amountLabel: formatCurrency(row.amount),
      });
    }

    for (const row of maintenanceRes.data || []) {
      const flat = row.flat as { flat_number?: string } | { flat_number?: string }[] | null;
      const flatNumber = Array.isArray(flat) ? flat[0]?.flat_number : flat?.flat_number;
      results.push({
        id: `maintenance-${row.id}`,
        type: "maintenance",
        title: row.receipt_number || "Maintenance receipt",
        subtitle: flatNumber ? `Flat ${flatNumber}` : "Maintenance payment",
        href: row.flat_id ? `/society/flats/${row.flat_id}` : "/maintenance",
        amountLabel: formatCurrency(row.amount),
      });
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Search failed"), results: [] };
  }
}
