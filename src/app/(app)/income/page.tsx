import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { IncomeManager } from "@/components/finance/income-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";
import { PAGE_SIZE } from "@/lib/constants";
import type { IncomeTransaction } from "@/types/database";

export const metadata = { title: "Income" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const value = (input: string | string[] | undefined) => typeof input === "string" ? input : "";

export default async function IncomePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const society = await getPrimarySociety();
  const params = await searchParams;
  const search = value(params.search).trim().replace(/[%_,()\"]/g, "").slice(0, 100);
  const category = value(params.category);
  const sort = ["date_desc", "date_asc", "amount_desc", "amount_asc"].includes(value(params.sort))
    ? value(params.sort) : "date_desc";
  const requestedPage = Math.max(1, Number.parseInt(value(params.page), 10) || 1);
  const from = (requestedPage - 1) * PAGE_SIZE;

  const [{ data: categories }, { data: flats }] = await Promise.all([
    supabase
      .from("income_categories")
      .select("*")
      .or(society ? `society_id.is.null,society_id.eq.${society.id}` : "society_id.is.null")
      .eq("status", "active")
      .order("name"),
    society
      ? supabase
          .from("flats")
          .select("*")
          .eq("society_id", society.id)
          .eq("status", "active")
          .order("flat_number")
      : Promise.resolve({ data: [] }),
  ]);

  let items: IncomeTransaction[] = [];
  let total = 0;
  const selectedCategory = (categories || []).some((item) => item.id === category) ? category : "";
  if (society) {
    let query = supabase
      .from("income_transactions")
      .select("*, category:income_categories(*), flat:flats(flat_number)", { count: "exact" })
      .eq("society_id", society.id);
    if (selectedCategory) query = query.eq("category_id", selectedCategory);
    if (search) {
      const matchingCategories = (categories || []).filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).map((item) => item.id);
      const conditions = ["person_name", "receipt_number", "reference_number", "description"].map((field) => `${field}.ilike.%${search}%`);
      if (matchingCategories.length) conditions.push(`category_id.in.(${matchingCategories.join(",")})`);
      query = query.or(conditions.join(","));
    }
    const sortColumn = sort.startsWith("amount") ? "amount" : "transaction_date";
    const ascending = sort.endsWith("asc");
    const result = await query.order(sortColumn, { ascending }).range(from, from + PAGE_SIZE - 1);
    items = result.data || [];
    total = result.count || 0;
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Income / Aavak"
        description="Track maintenance, parking, donations, and other society income."
      />
      <Suspense fallback={<PageSkeleton />}>
        <IncomeManager
          society={society}
          items={items || []}
          categories={categories || []}
          flats={flats || []}
          total={total}
          page={page}
          initialSearch={search}
          categoryFilter={selectedCategory}
          sort={sort as "date_desc" | "date_asc" | "amount_desc" | "amount_asc"}
        />
      </Suspense>
    </div>
  );
}
