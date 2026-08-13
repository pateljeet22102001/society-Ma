import { PageHeader } from "@/components/ui/page-header";
import { ReportsManager } from "@/components/reports/reports-manager";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();
  const [income, expenses, maintenance] = society ? await Promise.all([
    supabase.from("income_transactions").select("*, category:income_categories(name), flat:flats(flat_number)").eq("society_id", society.id).order("transaction_date", { ascending: false }),
    supabase.from("expense_transactions").select("*, category:expense_categories(name)").eq("society_id", society.id).order("transaction_date", { ascending: false }),
    supabase.from("maintenance_bills").select("*, flat:flats(flat_number, owner_name, wing:wings(name))").eq("society_id", society.id).order("bill_year", { ascending: false }).order("bill_month", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  return <div className="space-y-6">
    <PageHeader title="Reports" description="Download detailed financial and maintenance reports in PDF or Excel format." />
    <ReportsManager society={society} income={income.data || []} expenses={expenses.data || []} maintenance={maintenance.data || []} />
  </div>;
}
