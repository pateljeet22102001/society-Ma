import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { IncomeManager } from "@/components/finance/income-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Income" };

export default async function IncomePage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const [{ data: items }, { data: categories }, { data: flats }] = await Promise.all([
    society
      ? supabase
          .from("income_transactions")
          .select("*, category:income_categories(*), flat:flats(flat_number)")
          .eq("society_id", society.id)
          .order("transaction_date", { ascending: false })
      : Promise.resolve({ data: [] }),
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
        />
      </Suspense>
    </div>
  );
}
