import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";
import type { DashboardStats } from "@/types/database";

export async function getDashboardData() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  if (!society) {
    return {
      society: null,
      stats: {
        totalIncome: 0,
        totalExpense: 0,
        currentBalance: 0,
        totalFlats: 0,
        maintenanceCollected: 0,
        maintenancePending: 0,
        paidFlats: 0,
        pendingFlats: 0,
      } satisfies DashboardStats,
      recentIncome: [],
      recentExpenses: [],
      recentPayments: [],
      monthlyChart: [],
      maintenanceChart: { collected: 0, pending: 0, overdue: 0 },
    };
  }

  const [
    incomeRes,
    expenseRes,
    flatsRes,
    billsRes,
    recentIncomeRes,
    recentExpenseRes,
    recentPaymentsRes,
  ] = await Promise.all([
    supabase.from("income_transactions").select("amount, transaction_date").eq("society_id", society.id).eq("status", "active"),
    supabase.from("expense_transactions").select("amount, transaction_date").eq("society_id", society.id).eq("status", "active"),
    supabase.from("flats").select("id, status").eq("society_id", society.id),
    supabase
      .from("maintenance_bills")
      .select("paid_amount, pending_amount, status, flat_id")
      .eq("society_id", society.id),
    supabase
      .from("income_transactions")
      .select("*, category:income_categories(*), flat:flats(flat_number)")
      .eq("society_id", society.id)
      .eq("status", "active")
      .order("transaction_date", { ascending: false })
      .limit(5),
    supabase
      .from("expense_transactions")
      .select("*, category:expense_categories(*)")
      .eq("society_id", society.id)
      .eq("status", "active")
      .order("transaction_date", { ascending: false })
      .limit(5),
    supabase
      .from("maintenance_payments")
      .select("*, flat:flats(flat_number)")
      .eq("society_id", society.id)
      .order("payment_date", { ascending: false })
      .limit(5),
  ]);

  const totalIncome = (incomeRes.data || []).reduce((sum, row) => sum + Number(row.amount), 0);
  const totalExpense = (expenseRes.data || []).reduce((sum, row) => sum + Number(row.amount), 0);
  const totalFlats = flatsRes.data?.length || 0;
  const maintenanceCollected = (billsRes.data || []).reduce(
    (sum, row) => sum + Number(row.paid_amount),
    0,
  );
  const maintenancePending = (billsRes.data || []).reduce(
    (sum, row) => sum + Number(row.pending_amount),
    0,
  );
  const paidFlats = new Set(
    (billsRes.data || []).filter((b) => b.status === "paid").map((b) => b.flat_id),
  ).size;
  const pendingFlats = new Set(
    (billsRes.data || [])
      .filter((b) => b.status === "pending" || b.status === "partially_paid" || b.status === "overdue")
      .map((b) => b.flat_id),
  ).size;

  const monthMap = new Map<string, { month: string; income: number; expense: number }>();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleString("en-IN", { month: "short" });
    monthMap.set(key, { month: label, income: 0, expense: 0 });
  }

  for (const row of incomeRes.data || []) {
    const key = String(row.transaction_date).slice(0, 7);
    if (monthMap.has(key)) {
      monthMap.get(key)!.income += Number(row.amount);
    }
  }
  for (const row of expenseRes.data || []) {
    const key = String(row.transaction_date).slice(0, 7);
    if (monthMap.has(key)) {
      monthMap.get(key)!.expense += Number(row.amount);
    }
  }

  const maintenanceChart = {
    collected: maintenanceCollected,
    pending: (billsRes.data || [])
      .filter((b) => b.status === "pending" || b.status === "partially_paid")
      .reduce((sum, row) => sum + Number(row.pending_amount), 0),
    overdue: (billsRes.data || [])
      .filter((b) => b.status === "overdue")
      .reduce((sum, row) => sum + Number(row.pending_amount), 0),
  };

  return {
    society,
    stats: {
      totalIncome,
      totalExpense,
      currentBalance: totalIncome - totalExpense,
      totalFlats,
      maintenanceCollected,
      maintenancePending,
      paidFlats,
      pendingFlats,
    },
    recentIncome: recentIncomeRes.data || [],
    recentExpenses: recentExpenseRes.data || [],
    recentPayments: recentPaymentsRes.data || [],
    monthlyChart: Array.from(monthMap.values()),
    maintenanceChart,
  };
}
