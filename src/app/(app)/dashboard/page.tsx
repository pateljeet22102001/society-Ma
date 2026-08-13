import Link from "next/link";
import {
  Banknote,
  CircleDollarSign,
  Home,
  IndianRupee,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IncomeExpenseChart, MaintenanceChart } from "@/components/dashboard/charts";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getDashboardData } from "@/lib/queries/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { stats } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          data.society
            ? `Overview for ${data.society.name}`
            : "Create your society in Settings to start managing data."
        }
        actions={
          !data.society ? (
            <Link href="/settings">
              <Button>Setup Society</Button>
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Income"
          value={formatCurrency(stats.totalIncome)}
          icon={IndianRupee}
          tone="green"
          href="/income"
        />
        <StatCard
          title="Total Expense"
          value={formatCurrency(stats.totalExpense)}
          icon={Banknote}
          tone="rose"
          href="/expenses"
        />
        <StatCard
          title="Current Balance"
          value={formatCurrency(stats.currentBalance)}
          icon={CircleDollarSign}
          tone="blue"
          href="/reports"
        />
        <StatCard title="Total Flats" value={String(stats.totalFlats)} icon={Home} tone="slate" href="/society/flats" />
        <StatCard
          title="Maintenance Collected"
          value={formatCurrency(stats.maintenanceCollected)}
          icon={Wallet}
          tone="green"
          href="/maintenance?filter=collected&year=all"
        />
        <StatCard
          title="Maintenance Pending"
          value={formatCurrency(stats.maintenancePending)}
          icon={AlertCircle}
          tone="amber"
          href="/maintenance?filter=outstanding&year=all"
        />
        <StatCard title="Paid Flats" value={String(stats.paidFlats)} icon={CheckCircle2} tone="green" href="/maintenance?filter=paid&year=all" />
        <StatCard title="Pending Flats" value={String(stats.pendingFlats)} icon={Clock3} tone="amber" href="/maintenance?filter=outstanding&year=all" />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Quick Actions
        </h2>
        <QuickActions />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Monthly Income vs Expense" description="Last 6 months" />
          <CardContent>
            <IncomeExpenseChart data={data.monthlyChart} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Maintenance Collection" description="Collected vs pending overview" />
          <CardContent>
            <MaintenanceChart data={data.maintenanceChart} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Recent Income"
            action={
              <Link href="/income" className="text-sm font-medium text-primary">
                View all
              </Link>
            }
          />
          <CardContent className="space-y-3">
            {data.recentIncome.length ? (
              data.recentIncome.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {item.category?.name || "Income"}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(item.transaction_date)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-600">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No income records yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Recent Expenses"
            action={
              <Link href="/expenses" className="text-sm font-medium text-primary">
                View all
              </Link>
            }
          />
          <CardContent className="space-y-3">
            {data.recentExpenses.length ? (
              data.recentExpenses.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {item.category?.name || "Expense"}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(item.transaction_date)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-rose-600">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No expense records yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Recent Maintenance Payments"
            action={
              <Link href="/maintenance" className="text-sm font-medium text-primary">
                View all
              </Link>
            }
          />
          <CardContent className="space-y-3">
            {data.recentPayments.length ? (
              data.recentPayments.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {(item.flat as { flat_number?: string } | null)?.flat_number || "Flat"}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(item.payment_date)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-primary">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No maintenance payments yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
