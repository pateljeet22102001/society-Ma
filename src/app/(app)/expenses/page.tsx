import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseManager } from "@/components/finance/expense-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";
import { PAGE_SIZE } from "@/lib/constants";
import type { ExpenseTransaction } from "@/types/database";

export const metadata = { title: "Expenses" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : "";

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const society = await getPrimarySociety();
  const params = await searchParams;
  const search = value(params.search).trim().replace(/[%_,()\"]/g, "").slice(0, 100);
  const category = value(params.category);
  const sort = ["date_desc", "date_asc", "amount_desc", "amount_asc"].includes(value(params.sort)) ? value(params.sort) : "date_desc";
  const requestedPage = Math.max(1, Number.parseInt(value(params.page), 10) || 1);
  const from = (requestedPage - 1) * PAGE_SIZE;

  const { data: categories } = await supabase.from("expense_categories").select("*")
    .or(society ? `society_id.is.null,society_id.eq.${society.id}` : "society_id.is.null")
    .eq("status", "active").order("name");

  let items: ExpenseTransaction[] = [];
  let total = 0;
  const selectedCategory = (categories || []).some((item) => item.id === category) ? category : "";
  if (society) {
    let query = supabase.from("expense_transactions").select("*, category:expense_categories(*)", { count: "exact" }).eq("society_id", society.id);
    if (selectedCategory) query = query.eq("category_id", selectedCategory);
    if (search) {
      const matchingCategories = (categories || []).filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).map((item) => item.id);
      const conditions = ["vendor_name", "voucher_number", "bill_number", "reference_number", "description", "notes"].map((field) => `${field}.ilike.%${search}%`);
      if (matchingCategories.length) conditions.push(`category_id.in.(${matchingCategories.join(",")})`);
      query = query.or(conditions.join(","));
    }
    const sortColumn = sort.startsWith("amount") ? "amount" : "transaction_date";
    const result = await query.order(sortColumn, { ascending: sort.endsWith("asc") }).range(from, from + PAGE_SIZE - 1);
    items = result.data || [];
    total = result.count || 0;
  }
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / PAGE_SIZE)));

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Expense / Javak"
        description="Record electricity, security, repairs, and other society expenses."
      />
      <Suspense fallback={<PageSkeleton />}>
        <ExpenseManager society={society} items={items || []} categories={categories || []} total={total} page={page} initialSearch={search} categoryFilter={selectedCategory} sort={sort as "date_desc" | "date_asc" | "amount_desc" | "amount_asc"} />
      </Suspense>
    </div>
  );
}
