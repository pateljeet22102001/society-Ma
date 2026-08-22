import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";
import type { DashboardStats } from "@/types/database";

type DashboardSummary = DashboardStats & {
  monthlyChart: { month: string; income: number; expense: number }[];
  maintenanceChart: { collected: number; pending: number; overdue: number };
};

const emptyStats = {
  totalIncome: 0,
  totalExpense: 0,
  currentBalance: 0,
  totalFlats: 0,
  maintenanceCollected: 0,
  maintenancePending: 0,
  paidFlats: 0,
  pendingFlats: 0,
} satisfies DashboardStats;

export async function getDashboardData() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  if (!society) {
    return {
      society: null,
      stats: emptyStats,
      recentIncome: [],
      recentExpenses: [],
      recentPayments: [],
      monthlyChart: [],
      maintenanceChart: { collected: 0, pending: 0, overdue: 0 },
    };
  }

  const [summaryRes, recentIncomeRes, recentExpenseRes, recentPaymentsRes] = await Promise.all([
    supabase.rpc("get_dashboard_summary", { p_society_id: society.id }),
    supabase
      .from("income_transactions")
      .select("id, amount, transaction_date, category:income_categories(name)")
      .eq("society_id", society.id)
      .eq("status", "active")
      .order("transaction_date", { ascending: false })
      .limit(5),
    supabase
      .from("expense_transactions")
      .select("id, amount, transaction_date, category:expense_categories(name)")
      .eq("society_id", society.id)
      .eq("status", "active")
      .order("transaction_date", { ascending: false })
      .limit(5),
    supabase
      .from("maintenance_payments")
      .select("id, amount, payment_date, flat:flats(flat_number)")
      .eq("society_id", society.id)
      .order("payment_date", { ascending: false })
      .limit(5),
  ]);

  if (summaryRes.error) throw summaryRes.error;

  const summary = summaryRes.data as DashboardSummary;
  const stats = {
    totalIncome: Number(summary.totalIncome || 0),
    totalExpense: Number(summary.totalExpense || 0),
    currentBalance: Number(summary.totalIncome || 0) - Number(summary.totalExpense || 0),
    totalFlats: Number(summary.totalFlats || 0),
    maintenanceCollected: Number(summary.maintenanceCollected || 0),
    maintenancePending: Number(summary.maintenancePending || 0),
    paidFlats: Number(summary.paidFlats || 0),
    pendingFlats: Number(summary.pendingFlats || 0),
  } satisfies DashboardStats;
  const recentIncome = (recentIncomeRes.data || []).map((item) => ({
    ...item,
    category: Array.isArray(item.category) ? item.category[0] ?? null : item.category,
  })) as Array<{
    id: string;
    amount: number;
    transaction_date: string;
    category: { name: string } | null;
  }>;
  const recentExpenses = (recentExpenseRes.data || []).map((item) => ({
    ...item,
    category: Array.isArray(item.category) ? item.category[0] ?? null : item.category,
  })) as Array<{
    id: string;
    amount: number;
    transaction_date: string;
    category: { name: string } | null;
  }>;

  return {
    society,
    stats,
    recentIncome,
    recentExpenses,
    recentPayments: recentPaymentsRes.data || [],
    monthlyChart: (summary.monthlyChart || []).map((row) => ({
      month: row.month,
      income: Number(row.income || 0),
      expense: Number(row.expense || 0),
    })),
    maintenanceChart: {
      collected: Number(summary.maintenanceChart?.collected || 0),
      pending: Number(summary.maintenanceChart?.pending || 0),
      overdue: Number(summary.maintenanceChart?.overdue || 0),
    },
  };
}
