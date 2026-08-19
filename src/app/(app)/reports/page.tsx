import { ReportsManager } from "@/components/reports/reports-manager";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();
  const [income, expenses, maintenance, maintenancePayments, events, eventFlatContributions, eventFlatPayments, eventAavak, eventExpenses] = society ? await Promise.all([
    supabase.from("income_transactions").select("*, category:income_categories(name, slug), flat:flats(flat_number, wing:wings(name))").eq("society_id", society.id).eq("status", "active").order("transaction_date", { ascending: false }),
    supabase.from("expense_transactions").select("*, category:expense_categories(name)").eq("society_id", society.id).eq("status", "active").order("transaction_date", { ascending: false }),
    supabase.from("maintenance_bills").select("*, flat:flats(flat_number, owner_name, wing:wings(name))").eq("society_id", society.id).order("bill_year", { ascending: false }).order("bill_month", { ascending: false }),
    supabase.from("maintenance_payments").select("*, flat:flats(flat_number, wing:wings(name))").eq("society_id", society.id).order("payment_date", { ascending: false }),
    supabase.from("events").select("id, name, event_year").eq("society_id", society.id),
    supabase.from("event_flat_contributions").select("*, flat:flats(flat_number, owner_name)").eq("society_id", society.id),
    supabase.from("event_flat_payments").select("*, flat:flats(flat_number)").eq("society_id", society.id).order("payment_date", { ascending: false }),
    supabase.from("event_contributions").select("*").eq("society_id", society.id).order("contribution_date", { ascending: false }),
    supabase.from("event_expenses").select("*").eq("society_id", society.id).order("expense_date", { ascending: false }),
  ]) : Array.from({ length: 9 }, () => ({ data: [] }));

  return <div className="space-y-4 sm:space-y-6">
    <ReportsManager society={society} income={income.data || []} expenses={expenses.data || []} maintenance={maintenance.data || []} maintenancePayments={maintenancePayments.data || []} events={events.data || []} eventFlatContributions={eventFlatContributions.data || []} eventFlatPayments={eventFlatPayments.data || []} eventAavak={eventAavak.data || []} eventExpenses={eventExpenses.data || []} />
  </div>;
}
