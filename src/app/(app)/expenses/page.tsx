import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseManager } from "@/components/finance/expense-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const [{ data: items }, { data: categories }] = await Promise.all([
    society
      ? supabase
          .from("expense_transactions")
          .select("*, category:expense_categories(*)")
          .eq("society_id", society.id)
          .order("transaction_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("expense_categories")
      .select("*")
      .or(society ? `society_id.is.null,society_id.eq.${society.id}` : "society_id.is.null")
      .eq("status", "active")
      .order("name"),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Expense / Javak"
        description="Record electricity, security, repairs, and other society expenses."
      />
      <Suspense fallback={<PageSkeleton />}>
        <ExpenseManager society={society} items={items || []} categories={categories || []} />
      </Suspense>
    </div>
  );
}
