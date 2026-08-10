import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";
import { formatCurrency } from "@/lib/utils";
import { FileSpreadsheet, FileText } from "lucide-react";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();
  const year = new Date().getFullYear();

  let incomeTotal = 0;
  let expenseTotal = 0;
  let maintenanceCollected = 0;
  let maintenancePending = 0;

  if (society) {
    const [incomeRes, expenseRes, billsRes] = await Promise.all([
      supabase.from("income_transactions").select("amount").eq("society_id", society.id),
      supabase.from("expense_transactions").select("amount").eq("society_id", society.id),
      supabase
        .from("maintenance_bills")
        .select("paid_amount, pending_amount")
        .eq("society_id", society.id)
        .eq("bill_year", year),
    ]);

    incomeTotal = (incomeRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
    expenseTotal = (expenseRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
    maintenanceCollected = (billsRes.data || []).reduce((s, r) => s + Number(r.paid_amount), 0);
    maintenancePending = (billsRes.data || []).reduce((s, r) => s + Number(r.pending_amount), 0);
  }

  const reports = [
    { title: "Income Report", value: formatCurrency(incomeTotal), note: "All-time income total" },
    { title: "Expense Report", value: formatCurrency(expenseTotal), note: "All-time expense total" },
    {
      title: "Maintenance Collection",
      value: formatCurrency(maintenanceCollected),
      note: `${year} collected`,
    },
    {
      title: "Pending Maintenance",
      value: formatCurrency(maintenancePending),
      note: `${year} pending`,
    },
    {
      title: "Monthly Summary",
      value: formatCurrency(incomeTotal - expenseTotal),
      note: "Current balance foundation",
    },
    {
      title: "Yearly Summary",
      value: formatCurrency(incomeTotal - expenseTotal),
      note: "Ready for PDF/Excel export hooks",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Phase 1 summary reports. Architecture is ready for PDF and Excel exports."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title}>
            <CardHeader title={report.title} description={report.note} />
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">{report.value}</p>
              <div className="mt-4 flex gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                  <FileText className="h-3.5 w-3.5" /> PDF soon
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel soon
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
